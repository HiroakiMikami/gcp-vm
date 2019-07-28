/* eslint no-console: 0 */

import * as Compute from "@google-cloud/compute";

interface SnapshotMetadata {
  creationTimestamp: string;
}
interface Snapshot {
  getMetadata(): Promise<[SnapshotMetadata]>;
  delete(): Promise<void>;
  name: string;
}

function compareSnapshotWithMetadata(
  a: [Snapshot, SnapshotMetadata],
  b: [Snapshot, SnapshotMetadata]
): number {
  const aTimestamp = Date.parse(a[1].creationTimestamp);
  const bTimestamp = Date.parse(b[1].creationTimestamp);
  if (aTimestamp < bTimestamp) {
    // a is older than b
    return -1;
  } else if (aTimestamp > bTimestamp) {
    // a is newer than b
    return 1;
  } else {
    return 0;
  }
}

export async function canBeDeleted(
  compute: Compute,
  diskName: string,
  zone: string
): Promise<boolean> {
  const [vms] = await compute.zone(zone).getVMs();

  const metadata = await Promise.all(
    vms.map(vm => vm.getMetadata().then(data => data[0]))
  );

  // Check whether the VM using the disk exists or not. If there is no VM, the disk can be deleted
  for (const d of metadata) {
    const disks = d["disks"] || [];
    for (const disk of disks) {
      if (disk["deviceName"] === diskName) {
        return false;
      }
    }
  }
  return true;
}

export async function deleteDisk(
  compute: Compute,
  diskName: string,
  zone: string
): Promise<void> {
  const disk = compute.zone(zone).disk(diskName);
  /* check whether the disk exists or not */
  const e = await disk.exists();
  if (!e[0]) {
    throw new Error(`The disk "${diskName}" does not exist in "${zone}"`);
  }

  const f = await canBeDeleted(compute, diskName, zone);
  if (!f) {
    throw new Error(
      `Skip deleting the disk ("${diskName}") in "${zone}": The VM uses this disk`
    );
  }

  console.log(`Delete the disk "${diskName}"`);
  return disk.delete();
}

/**
 * Delete the disks
 *
 * Expects a PubSub message with JSON-formatted event data containing the
 * following attributes:
 *  disks - the array of the disks. Each element has 0) the GCP zone the disk is located in and 1) the name of the disk.
 *
 * @param {!object} event Cloud Function PubSub message event.
 */
export async function deleteDiskPubSub(event: { data: string }): Promise<void> {
  const pubsubMessage = event.data;
  const payload = JSON.parse(Buffer.from(pubsubMessage, "base64").toString());
  const compute = new Compute();
  await Promise.all(
    payload.disks.map(disk => deleteDisk(compute, disk[0], disk[1]))
  );
  const message = `Successfully delete disks: ${payload.disks}`;
  console.log(message);
  return;
}

export async function listSnapshots(
  compute: Compute,
  labelName: string,
  diskName: string,
  zone: string
): Promise<Snapshot[]> {
  const [data] = await compute.getSnapshots({
    filter: `labels.${labelName}="${zone}_${diskName}"`
  });
  return data;
}

export async function removeOldSnapshots(
  compute: Compute,
  labelName: string,
  diskName: string,
  zone: string,
  maxNumOfSnapshots
): Promise<void> {
  maxNumOfSnapshots = Math.max(1, maxNumOfSnapshots);
  const snapshots = await listSnapshots(compute, labelName, diskName, zone);
  if (snapshots.length > maxNumOfSnapshots) {
    const numDelete = snapshots.length - maxNumOfSnapshots;
    console.log(`Remove ${numDelete} snapshots of "${diskName}"`);
    let snapshotsWithMetadata: [
      Snapshot,
      SnapshotMetadata
    ][] = await Promise.all(
      snapshots.map(async function(
        snapshot
      ): Promise<[Snapshot, SnapshotMetadata]> {
        const [metadata] = await snapshot.getMetadata();
        return [snapshot, metadata];
      })
    );
    snapshotsWithMetadata = snapshotsWithMetadata.sort(
      compareSnapshotWithMetadata
    );

    let results: Promise<void>[] = [];
    for (let i = 0; i < numDelete; ++i) {
      console.log(`Remove the snapshot "${snapshotsWithMetadata[i][0].name}"`);
      results.push(snapshotsWithMetadata[i][0].delete());
    }
    await Promise.all(results);
    return;
  }
  return;
}

/**
 * Remove old snapshots
 *
 * Expects a PubSub message with JSON-formatted event data containing the
 * following attributes:
 *  disks - the array of the disks. Each element has 0) the GCP zone the disk is located in and 1) the name of the disk.
 *  maxNumOfSnapshots - the maximum number of snapshots
 *  labelPrefix - the prefix of the label names
 *
 * @param {!object} event Cloud Function PubSub message event.
 */
export async function removeOldSnapshotsPubSub(event: {
  data: string;
}): Promise<void> {
  const pubsubMessage = event.data;
  const payload = JSON.parse(Buffer.from(pubsubMessage, "base64").toString());
  const compute = new Compute();
  const maxNumOfSnapshots = payload.maxNumOfSnapshots;
  const labelName = `${payload.labelPrefix || "gcp_vm"}__disk_name`;
  if (!maxNumOfSnapshots) {
    throw new Error("maxNumOfSnapshots is not specified");
  }
  await Promise.all(
    payload.disks.map(disk =>
      removeOldSnapshots(
        compute,
        labelName,
        disk[0],
        disk[1],
        maxNumOfSnapshots
      )
    )
  );
  const message = `Successfully delete old snapshots ${payload.disks}`;
  console.log(message);
  return;
}

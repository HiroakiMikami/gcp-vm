/* eslint no-console: 0 */

import * as Compute from "@google-cloud/compute";

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

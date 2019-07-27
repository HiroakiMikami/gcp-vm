import * as Compute from "@google-cloud/compute";
import { Dictionary } from "lodash";

export interface LabelOptions {
  diskNameLabel: string;
  projectLabel: string;
  diskTypeLabel: string;
}

function zoneToRegion(zone: string): string {
  const i = zone.lastIndexOf("-");
  if (i === -1) {
    return zone;
  }
  return zone.substr(0, i);
}

function parseDiskType(
  apiUrl: string,
  url: string
): { diskType: string; project: string; zone: string } {
  if (!url.startsWith(apiUrl)) {
    throw new Error(`Invalid disk type: ${url}`);
  }
  const tokens = url.split("/");
  return {
    diskType: tokens[tokens.indexOf("diskTypes") + 1],
    project: tokens[tokens.indexOf("projects") + 1],
    zone: tokens[tokens.indexOf("zones") + 1]
  };
}

function createDiskType(
  apiUrl: string,
  project: string,
  zone: string,
  diskType: string
): string {
  return `${apiUrl}/projects/${project}/zones/${zone}/diskTypes/${diskType}`;
}

interface SnapshotMetadata {
  creationTimestamp: string;
  labels: Dictionary<string>;
  diskSizeGb: number;
  selfLink: string;
}

function compareSnapshotWithMetadata(
  a: [{}, SnapshotMetadata],
  b: [{}, SnapshotMetadata]
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

export class GCP {
  public constructor(
    private options: LabelOptions,
    private compute: Compute = new Compute(),
    private apiUrl = "https://www.googleapis.com/compute/v1"
  ) {}
  public async restoreDsik(diskName: string, zone: string): Promise<void> {
    const disk = this.compute.zone(zone).disk(diskName);

    if ((await disk.exists())[0]) {
      // Disk exists
      return;
    }

    // Find the newest snapshot corresponding to the disk
    const snapshots = (await this.compute.getSnapshots({
      filter: `labels.${this.options.diskNameLabel}=${zone}_${diskName}`
    }))[0];
    let snapshotsWithMetadata: [{}, SnapshotMetadata][] = await Promise.all(
      snapshots.map(async snapshot => {
        const data = (await snapshot.getMetadata())[0];
        return [snapshot, data];
      })
    );
    snapshotsWithMetadata = snapshotsWithMetadata.sort(
      compareSnapshotWithMetadata
    );

    if (snapshotsWithMetadata.length === 0) {
      throw new Error(
        `There are no snapshots correspoindng to ${diskName} in ${zone}`
      );
    }

    const metadata = snapshotsWithMetadata[snapshotsWithMetadata.length - 1][1];

    // Create a disk from the snapshot
    const type = metadata.labels[this.options.diskTypeLabel];
    const project = metadata.labels[this.options.projectLabel];
    const configs = {
      sizeGb: metadata.diskSizeGb,
      sourceSnapshot: metadata.selfLink,
      type: createDiskType(this.apiUrl, project, zone, type)
    };
    const op = await disk.create(configs);
    await op[1].promise();
  }
  public async createSnapshot(
    diskName: string,
    snapshotName: string,
    zone: string
  ): Promise<void> {
    let labels = {};
    labels[this.options.diskNameLabel] = `${zone}_${diskName}`;
    const disk = this.compute.zone(zone).disk(diskName);

    const [metadata] = await disk.getMetadata();
    const type = parseDiskType(this.apiUrl, metadata.type);
    labels[this.options.projectLabel] = type.project;
    labels[this.options.diskTypeLabel] = type.diskType;

    // Create snapshot
    const configs = { labels, storageLocations: [zoneToRegion(zone)] };
    const op = await disk.createSnapshot(snapshotName, configs);
    await op[1].promise();
  }
}

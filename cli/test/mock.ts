import { mock, instance, when, anything } from "ts-mockito";
import * as Compute from "@google-cloud/compute";
import { Dictionary } from "lodash";

export const mockLabelOptions = {
  diskNameLabel: "diskName",
  projectLabel: "project",
  diskTypeLabel: "diskType"
};

class MockOperation {
  public promise(): Promise<void> {
    return Promise.resolve();
  }
}

export interface MockObject<T> {
  mocked: T;
  instance: T;
}

interface Snapshot {
  metadata: SnapshotMetadata;
  getMetadata(): Promise<[SnapshotMetadata]>;
}
interface SnapshotMetadata {
  labels: Dictionary<string>;
  creationTimestamp: Date;
  diskSizeGb: number;
  selfLink: string;
}

interface Disk {
  exists(): Promise<[boolean]>;
  create(configs: {}): Promise<[{} | null, MockOperation]>;
  getMetadata(): Promise<[{}]>;
  createSnapshot(
    name: string,
    configs: {}
  ): Promise<[{} | null, MockOperation]>;
}

interface Zone {
  disk(name: string): Disk;
}

export function mcokSnapshot(metadata: SnapshotMetadata): MockObject<Snapshot> {
  let mockedSnapshot: Snapshot = mock<Snapshot>();
  if (metadata) {
    when(mockedSnapshot.getMetadata()).thenResolve([metadata]);
  }
  let snapshot = instance(mockedSnapshot);
  snapshot.metadata = metadata;
  return { mocked: mockedSnapshot, instance: snapshot };
}

export function mockDisk(metadata: {} | null): MockObject<Disk> {
  let mockedDisk: Disk = mock<Disk>();
  if (metadata) {
    when(mockedDisk.exists()).thenResolve([true]);
    when(mockedDisk.getMetadata()).thenResolve([metadata]);
    when(mockedDisk.createSnapshot(anything(), anything())).thenCall(() => {
      return Promise.resolve([null, new MockOperation()]);
    });
  } else {
    when(mockedDisk.exists()).thenResolve([false]);
    when(mockedDisk.create(anything())).thenCall(() => {
      when(mockedDisk.exists()).thenResolve([true]); // TODO
      return Promise.resolve([null, new MockOperation()]);
    });
  }
  const disk = instance(mockedDisk);

  return { mocked: mockedDisk, instance: disk };
}

export function mockZone(disks: ReadonlyMap<string, Disk>): MockObject<Zone> {
  let mockedZone: Zone = mock<Zone>();
  disks.forEach((disk, name) => {
    when(mockedZone.disk(name)).thenReturn(disk);
  });
  const zone = instance(mockedZone);

  return { mocked: mockedZone, instance: zone };
}

export function mockCompute(
  zones: ReadonlyMap<string, Zone>,
  snapshots: ReadonlyMap<string, Snapshot>
): MockObject<Compute> {
  let mockedCompute: Compute = mock(Compute);
  zones.forEach((zone, name) => {
    when(mockedCompute.zone(name)).thenReturn(zone);
  });
  when(mockedCompute.getSnapshots(anything())).thenCall(query => {
    if (
      (query.filter as string).startsWith(
        `labels.${mockLabelOptions.diskNameLabel}=`
      )
    ) {
      const label = (query.filter as string).replace(
        `labels.${mockLabelOptions.diskNameLabel}=`,
        ""
      );
      return Promise.resolve([
        Array.from(snapshots)
          .filter(elem => {
            const snapshot = elem[1];
            return (
              snapshot.metadata.labels[mockLabelOptions.diskNameLabel] === label
            );
          })
          .map(elem => elem[1])
      ]);
    }
    return Promise.resolve([[]]);
  });
  const compute = instance(mockedCompute);

  return { mocked: mockedCompute, instance: compute };
}

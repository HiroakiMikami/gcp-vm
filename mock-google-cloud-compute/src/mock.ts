/* eslint @typescript-eslint/no-explicit-any: 0 */

import * as Compute from "@google-cloud/compute";
import { Dictionary } from "lodash";

interface TsMockito {
  mock<T>(clazz?: T): T;
  instance<T>(mockedValue: T): T;
  when<T>(method: Promise<T>): any;
  when<T>(method: T): any;
  anything(): any;
}

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

interface Vm {
  start(): Promise<[MockOperation]>;
  stop(): Promise<[MockOperation]>;
  delete(): Promise<[MockOperation]>;
  getMetadata(): Promise<[{}]>;
}

interface Zone {
  disk(name: string): Disk;
  vm(name: string): Vm;
  createVM(name: string, configs: {}): Promise<[{} | null, MockOperation]>;
}

export function mockSnapshot(
  mock: TsMockito,
  metadata: SnapshotMetadata
): MockObject<Snapshot> {
  let mockedSnapshot: Snapshot = mock.mock<Snapshot>();
  if (metadata) {
    mock.when(mockedSnapshot.getMetadata()).thenResolve([metadata]);
  }
  let snapshot = mock.instance(mockedSnapshot);
  snapshot.metadata = metadata;
  return { mocked: mockedSnapshot, instance: snapshot };
}

export function mockDisk(
  mock: TsMockito,
  metadata: {} | null
): MockObject<Disk> {
  let mockedDisk: Disk = mock.mock<Disk>();
  if (metadata) {
    mock.when(mockedDisk.exists()).thenResolve([true]);
    mock.when(mockedDisk.getMetadata()).thenResolve([metadata]);
    mock
      .when(mockedDisk.createSnapshot(mock.anything(), mock.anything()))
      .thenCall(() => {
        return Promise.resolve([null, new MockOperation()]);
      });
  } else {
    mock.when(mockedDisk.exists()).thenResolve([false]);
    mock.when(mockedDisk.create(mock.anything())).thenCall(() => {
      mock.when(mockedDisk.exists()).thenResolve([true]); // TODO
      return Promise.resolve([null, new MockOperation()]);
    });
  }
  const disk = mock.instance(mockedDisk);

  return { mocked: mockedDisk, instance: disk };
}

export function mockVm(mock: TsMockito, metadata: {}): MockObject<Vm> {
  let mockedVm = mock.mock<Vm>();
  mock.when(mockedVm.start()).thenResolve([new MockOperation()]);
  mock.when(mockedVm.stop()).thenResolve([new MockOperation()]);
  mock.when(mockedVm.delete()).thenResolve([new MockOperation()]);
  mock.when(mockedVm.getMetadata()).thenResolve([metadata]);
  const vm = mock.instance(mockedVm);

  return { mocked: mockedVm, instance: vm };
}

export function mockZone(
  mock: TsMockito,
  vms: ReadonlyMap<string, Vm>,
  disks: ReadonlyMap<string, Disk>
): MockObject<Zone> {
  let mockedZone: Zone = mock.mock<Zone>();
  vms.forEach((vm, name) => {
    mock.when(mockedZone.vm(name)).thenReturn(vm);
  });
  disks.forEach((disk, name) => {
    mock.when(mockedZone.disk(name)).thenReturn(disk);
  });
  mock
    .when(mockedZone.createVM(mock.anything(), mock.anything()))
    .thenCall(() => {
      return Promise.resolve([null, new MockOperation()]);
    });
  const zone = mock.instance(mockedZone);

  return { mocked: mockedZone, instance: zone };
}

export function mockCompute(
  mock: TsMockito,
  zones: ReadonlyMap<string, Zone>,
  snapshots: ReadonlyMap<string, Snapshot>
): MockObject<Compute> {
  let mockedCompute: Compute = mock.mock(Compute);
  zones.forEach((zone, name) => {
    mock.when(mockedCompute.zone(name)).thenReturn(zone);
  });
  mock.when(mockedCompute.getSnapshots(mock.anything())).thenCall(query => {
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
  const compute = mock.instance(mockedCompute);

  return { mocked: mockedCompute, instance: compute };
}

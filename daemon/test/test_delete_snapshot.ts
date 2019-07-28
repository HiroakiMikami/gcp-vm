/* eslint-env mocha */

import * as chai from "chai";
import * as mock from "gcp-vm-mock";
import * as mockito from "ts-mockito";
import { verify, capture, anything } from "ts-mockito";
import { listSnapshots, removeOldSnapshots } from "../src/main";
chai.should();

describe("DeleteSnapshot daemon", () => {
  describe("#listSnapshots", () => {
    it("search the snapshot that created from the given disk", async () => {
      const snapshot = mock.mockSnapshot(mockito, {
        creationTimestamp: new Date("2018/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: '"zone-a_disk"',
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const snapshot2 = mock.mockSnapshot(mockito, {
        creationTimestamp: new Date("2018/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: '"zone-a_disk2"',
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const compute = mock.mockCompute(
        mockito,
        new Map(),
        new Map([
          ["snapshot", snapshot.instance],
          ["snapshot2", snapshot2.instance]
        ])
      );

      const retval = await listSnapshots(
        compute.instance,
        "diskName",
        "disk",
        "zone-a"
      );
      retval.should.deep.equal([snapshot.instance]);
      verify(compute.mocked.getSnapshots(anything())).once();
      capture(compute.mocked.getSnapshots)
        .last()
        .should.deep.equal([{ filter: 'labels.diskName="zone-a_disk"' }]);
    });
  });
  describe("#removeOldSnapshots", () => {
    it("do nothing if the number of snapshots is smaller than threshold", async () => {
      const snapshot = mock.mockSnapshot(mockito, {
        creationTimestamp: new Date("2018/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: '"zone-a_disk"',
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const compute = mock.mockCompute(
        mockito,
        new Map(),
        new Map([["snapshot", snapshot.instance]])
      );
      await removeOldSnapshots(
        compute.instance,
        "diskName",
        "disk",
        "zone-a",
        5
      );
      verify(compute.mocked.getSnapshots(anything())).once();
      capture(compute.mocked.getSnapshots)
        .last()
        .should.deep.equal([{ filter: 'labels.diskName="zone-a_disk"' }]);
      verify(snapshot.mocked.delete()).never();
    });
    it("remove old snapshots", async () => {
      const oldSnapshot1 = mock.mockSnapshot(mockito, {
        creationTimestamp: new Date("2018/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: '"zone-a_disk"',
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const oldSnapshot2 = mock.mockSnapshot(mockito, {
        creationTimestamp: new Date("2018/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: '"zone-a_disk"',
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const newSnapshot1 = mock.mockSnapshot(mockito, {
        creationTimestamp: new Date("2019/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: '"zone-a_disk"',
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const newSnapshot2 = mock.mockSnapshot(mockito, {
        creationTimestamp: new Date("2019/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: '"zone-a_disk"',
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const compute = mock.mockCompute(
        mockito,
        new Map(),
        new Map([
          ["old1", oldSnapshot1.instance],
          ["old2", oldSnapshot2.instance],
          ["new1", newSnapshot1.instance],
          ["new2", newSnapshot2.instance]
        ])
      );
      await removeOldSnapshots(
        compute.instance,
        "diskName",
        "disk",
        "zone-a",
        2
      );
      verify(compute.mocked.getSnapshots(anything())).once();
      capture(compute.mocked.getSnapshots)
        .last()
        .should.deep.equal([{ filter: 'labels.diskName="zone-a_disk"' }]);
      verify(oldSnapshot1.mocked.getMetadata()).once();
      verify(oldSnapshot2.mocked.getMetadata()).once();
      verify(newSnapshot1.mocked.getMetadata()).once();
      verify(newSnapshot2.mocked.getMetadata()).once();
      verify(oldSnapshot1.mocked.delete()).once();
      verify(oldSnapshot2.mocked.delete()).once();
    });
  });
});

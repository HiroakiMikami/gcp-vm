/* eslint-env mocha */

import * as chai from "chai";
import * as mock from "./mock";
import { verify, anything, capture } from "ts-mockito";
chai.should();

import { GCP } from "../src/gcp";
import { fail } from "assert";

describe("GCP", () => {
  describe("#restoreDisk", () => {
    it("do nothing if the disk exists", async () => {
      const disk = mock.mockDisk({ selfLink: "link" });
      const zone = mock.mockZone(new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );
      await gcp.restoreDsik("test", "zone");

      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.disk("test")).once();
      verify(disk.mocked.exists()).once();
      verify(compute.mocked.zone("zone")).calledBefore(
        zone.mocked.disk("test")
      );
      verify(zone.mocked.disk("test")).calledBefore(disk.mocked.exists());
      verify(disk.mocked.create(anything())).never();
    });
    it("restore the disk from the newest snapshot", async () => {
      const disk = mock.mockDisk(null);
      const oldSnapshot = mock.mcokSnapshot({
        creationTimestamp: new Date("2018/1/1"),
        diskSizeGb: 32,
        labels: {
          diskName: "zone_test",
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "old"
      });
      const newSnapshot = mock.mcokSnapshot({
        creationTimestamp: new Date("2019/1/1"),
        diskSizeGb: 128,
        labels: {
          diskName: "zone_test",
          diskType: "pd_standard",
          project: "project"
        },
        selfLink: "new"
      });
      const zone = mock.mockZone(new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map([["old", oldSnapshot.instance], ["new", newSnapshot.instance]])
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );
      await gcp.restoreDsik("test", "zone");

      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.disk("test")).once();
      verify(disk.mocked.exists()).once();
      verify(compute.mocked.getSnapshots(anything())).once();
      capture(compute.mocked.getSnapshots)
        .last()
        .should.deep.equal([{ filter: "labels.diskName=zone_test" }]);
      verify(newSnapshot.mocked.getMetadata()).once();
      verify(oldSnapshot.mocked.getMetadata()).once();
      verify(disk.mocked.create(anything())).once();
      capture(disk.mocked.create)
        .last()
        .should.deep.equal([
          {
            sizeGb: 128,
            sourceSnapshot: "new",
            type:
              "https://tmp/projects/project/zones/zone/diskTypes/pd_standard"
          }
        ]);
    });
    it("throw an error if there are no disks and no snapshots", async () => {
      const disk = mock.mockDisk(null);
      const zone = mock.mockZone(new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );
      try {
        await gcp.restoreDsik("test", "zone");
        fail();
      } catch (e) {
        e.message.should.deep.equal(
          "There are no snapshots correspoindng to test in zone"
        );
      }
    });
  });
});

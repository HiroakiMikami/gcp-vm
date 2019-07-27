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
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
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
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
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
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
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
  describe("#createSnapshot", () => {
    it("create snapshot", async () => {
      const disk = mock.mockDisk({
        selfLink: "link",
        type: "https://tmp/projects/project/zones/zone/diskTypes/pd_standard"
      });
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );
      await gcp.createSnapshot("test", "snapshot", "zone");

      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.disk("test")).once();
      verify(disk.mocked.getMetadata()).once();
      verify(disk.mocked.createSnapshot(anything(), anything())).once();
      capture(disk.mocked.createSnapshot)
        .last()
        .should.deep.equal([
          "snapshot",
          {
            labels: {
              diskName: "zone_test",
              diskType: "pd_standard",
              project: "project"
            },
            storageLocations: ["zone"]
          }
        ]);
    });
  });
  describe("#createMachine", () => {
    it("create a VM", async () => {
      const disk = mock.mockDisk({ selfLink: "link" });
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );

      await gcp.createMachine("vm", "test", "zone", "n1-highmem-4", {
        accelerators: [],
        preemptible: false,
        tags: []
      });
      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.disk("test")).once();
      verify(disk.mocked.getMetadata()).once();
      verify(zone.mocked.createVM("vm", anything())).once();
      capture(zone.mocked.createVM)
        .last()
        .should.deep.equal([
          "vm",
          {
            disks: [
              {
                autoDelete: false,
                boot: true,
                deviceName: "test",
                kind: "compute#attachedDisk",
                mode: "READ_WRITE",
                source: "link",
                type: "PERSISTENT"
              }
            ],
            guestAccelerators: [],
            machineType: "n1-highmem-4",
            networkInterfaces: [
              {
                accessConfigs: [
                  {
                    kind: "compute#accessConfig",
                    name: "External NAT",
                    networkTier: "PREMIUM",
                    type: "ONE_TO_ONE_NAT"
                  }
                ],
                aliasIpRanges: [],
                kind: "compute#networkInterface"
              }
            ],
            scheduling: {
              automaticRestart: false,
              onHostMaintenance: "TERMINATE",
              preemptible: false
            },
            tags: []
          }
        ]);
    });
    it("specify a custum machine type", async () => {
      const disk = mock.mockDisk({ selfLink: "link" });
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );

      await gcp.createMachine(
        "vm",
        "test",
        "zone",
        { vCPU: 24, memory: 100 },
        {
          accelerators: [],
          preemptible: false,
          tags: []
        }
      );
      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.disk("test")).once();
      verify(disk.mocked.getMetadata()).once();
      verify(zone.mocked.createVM("vm", anything())).once();
      capture(zone.mocked.createVM)
        .last()
        .should.deep.equal([
          "vm",
          {
            disks: [
              {
                autoDelete: false,
                boot: true,
                deviceName: "test",
                kind: "compute#attachedDisk",
                mode: "READ_WRITE",
                source: "link",
                type: "PERSISTENT"
              }
            ],
            guestAccelerators: [],
            machineType: "custum-24-102400",
            networkInterfaces: [
              {
                accessConfigs: [
                  {
                    kind: "compute#accessConfig",
                    name: "External NAT",
                    networkTier: "PREMIUM",
                    type: "ONE_TO_ONE_NAT"
                  }
                ],
                aliasIpRanges: [],
                kind: "compute#networkInterface"
              }
            ],
            scheduling: {
              automaticRestart: false,
              onHostMaintenance: "TERMINATE",
              preemptible: false
            },
            tags: []
          }
        ]);
    });
    it("add accelerator", async () => {
      const disk = mock.mockDisk({ selfLink: "link" });
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );

      await gcp.createMachine("vm", "test", "zone", "n1-highmem-4", {
        accelerators: [{ deviceType: "nvidia-tesla-k80", count: 1 }],
        preemptible: false,
        tags: []
      });
      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.disk("test")).once();
      verify(disk.mocked.getMetadata()).once();
      verify(zone.mocked.createVM("vm", anything())).once();
      capture(zone.mocked.createVM)
        .last()
        .should.deep.equal([
          "vm",
          {
            disks: [
              {
                autoDelete: false,
                boot: true,
                deviceName: "test",
                kind: "compute#attachedDisk",
                mode: "READ_WRITE",
                source: "link",
                type: "PERSISTENT"
              }
            ],
            guestAccelerators: [
              { acceleratorType: "nvidia-tesla-k80", acceleratorCount: 1 }
            ],
            machineType: "n1-highmem-4",
            networkInterfaces: [
              {
                accessConfigs: [
                  {
                    kind: "compute#accessConfig",
                    name: "External NAT",
                    networkTier: "PREMIUM",
                    type: "ONE_TO_ONE_NAT"
                  }
                ],
                aliasIpRanges: [],
                kind: "compute#networkInterface"
              }
            ],
            scheduling: {
              automaticRestart: false,
              onHostMaintenance: "TERMINATE",
              preemptible: false
            },
            tags: []
          }
        ]);
    });
    it("specify the network tags", async () => {
      const disk = mock.mockDisk({ selfLink: "link" });
      const zone = mock.mockZone(new Map(), new Map([["test", disk.instance]]));
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );

      await gcp.createMachine("vm", "test", "zone", "n1-highmem-4", {
        accelerators: [],
        preemptible: false,
        tags: ["foo", "bar"]
      });
      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.disk("test")).once();
      verify(disk.mocked.getMetadata()).once();
      verify(zone.mocked.createVM("vm", anything())).once();
      capture(zone.mocked.createVM)
        .last()
        .should.deep.equal([
          "vm",
          {
            disks: [
              {
                autoDelete: false,
                boot: true,
                deviceName: "test",
                kind: "compute#attachedDisk",
                mode: "READ_WRITE",
                source: "link",
                type: "PERSISTENT"
              }
            ],
            guestAccelerators: [],
            machineType: "n1-highmem-4",
            networkInterfaces: [
              {
                accessConfigs: [
                  {
                    kind: "compute#accessConfig",
                    name: "External NAT",
                    networkTier: "PREMIUM",
                    type: "ONE_TO_ONE_NAT"
                  }
                ],
                aliasIpRanges: [],
                kind: "compute#networkInterface"
              }
            ],
            scheduling: {
              automaticRestart: false,
              onHostMaintenance: "TERMINATE",
              preemptible: false
            },
            tags: ["foo", "bar"]
          }
        ]);
    });
  });
  describe("#startMachine", () => {
    it("start a VM", async () => {
      const vm = mock.mockVm();
      const zone = mock.mockZone(new Map([["vm", vm.instance]]), new Map());
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );
      await gcp.startMachine("vm", "zone");
      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.vm("vm")).once();
      verify(vm.mocked.start()).once();
    });
  });
  describe("#stopMachine", () => {
    it("stop a VM", async () => {
      const vm = mock.mockVm();
      const zone = mock.mockZone(new Map([["vm", vm.instance]]), new Map());
      const compute = mock.mockCompute(
        new Map([["zone", zone.instance]]),
        new Map()
      );
      const gcp = new GCP(
        mock.mockLabelOptions,
        compute.instance,
        "https://tmp"
      );
      await gcp.stopMachine("vm", "zone");
      verify(compute.mocked.zone("zone")).once();
      verify(zone.mocked.vm("vm")).once();
      verify(vm.mocked.stop()).once();
    });
  });
});

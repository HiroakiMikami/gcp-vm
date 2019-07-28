/* eslint-env mocha */

import * as chai from "chai";
import * as mock from "gcp-vm-mock";
import * as mockito from "ts-mockito";
import { verify } from "ts-mockito";
import { canBeDeleted, deleteDisk } from "../src/main";
chai.should();

describe("DeleteDisk daemon", () => {
  describe("#canBeDeleted", () => {
    it("return true if there is no instance using the disk", async () => {
      const vm = mock.mockVm(mockito, {});
      const zone = mock.mockZone(
        mockito,
        new Map([["test", vm.instance]]),
        new Map()
      );
      const compute = mock.mockCompute(
        mockito,
        new Map([["zone-a", zone.instance]]),
        new Map()
      );
      const retval = await canBeDeleted(compute.instance, "disk", "zone-a");

      retval.should.equal(true);
      verify(compute.mocked.zone("zone-a")).once();
      verify(zone.mocked.getVMs()).once();
      verify(vm.mocked.getMetadata()).once();
    });
    it("return true if there is no instance", async () => {
      const zone = mock.mockZone(mockito, new Map(), new Map());
      const compute = mock.mockCompute(
        mockito,
        new Map([["zone-a", zone.instance]]),
        new Map()
      );
      const retval = await canBeDeleted(compute.instance, "disk", "zone-a");

      retval.should.equal(true);
      verify(compute.mocked.zone("zone-a")).once();
      verify(zone.mocked.getVMs()).once();
    });
    it("return false if there is some instnaces using the disk", async () => {
      const vm = mock.mockVm(mockito, { disks: [{ deviceName: "disk" }] });
      const zone = mock.mockZone(
        mockito,
        new Map([["test", vm.instance]]),
        new Map()
      );
      const compute = mock.mockCompute(
        mockito,
        new Map([["zone-a", zone.instance]]),
        new Map()
      );
      const retval = await canBeDeleted(compute.instance, "disk", "zone-a");
      retval.should.equal(false);
      verify(compute.mocked.zone("zone-a")).once();
      verify(vm.mocked.getMetadata()).once();
    });
  });
  describe("#deleteDisk", () => {
    it("delete the disk", async () => {
      const disk = mock.mockDisk(mockito, {});
      const zone = mock.mockZone(
        mockito,
        new Map(),
        new Map([["disk", disk.instance]])
      );
      const compute = mock.mockCompute(
        mockito,
        new Map([["zone-a", zone.instance]]),
        new Map()
      );
      await deleteDisk(compute.instance, "disk", "zone-a");
      verify(compute.mocked.zone("zone-a")).twice();
      verify(zone.mocked.disk("disk")).once();
      verify(disk.mocked.exists()).once();
      verify(zone.mocked.getVMs()).once();
      verify(disk.mocked.delete()).once();
    });
    it("skip deleting the disk if the disk is used by VMs", async () => {
      const vm = mock.mockVm(mockito, { disks: [{ deviceName: "disk" }] });
      const disk = mock.mockDisk(mockito, {});
      const zone = mock.mockZone(
        mockito,
        new Map([["test", vm.instance]]),
        new Map([["disk", disk.instance]])
      );
      const compute = mock.mockCompute(
        mockito,
        new Map([["zone-a", zone.instance]]),
        new Map()
      );
      try {
        await deleteDisk(compute.instance, "disk", "zone-a");
      } catch (err) {
        err.message.should.deep.equal(
          `Skip deleting the disk ("disk") in "zone-a": The VM uses this disk`
        );
      }
      verify(compute.mocked.zone("zone-a")).twice();
      verify(zone.mocked.disk("disk")).once();
      verify(disk.mocked.exists()).once();
      verify(zone.mocked.getVMs()).once();
      verify(vm.mocked.getMetadata()).once();
      verify(disk.mocked.delete()).never();
    });
    it("skip deleting the disk if it does not exist", async () => {
      const disk = mock.mockDisk(mockito, null);
      const zone = mock.mockZone(
        mockito,
        new Map(),
        new Map([["disk", disk.instance]])
      );
      const compute = mock.mockCompute(
        mockito,
        new Map([["zone-a", zone.instance]]),
        new Map()
      );
      try {
        await deleteDisk(compute.instance, "disk", "zone-a");
      } catch (err) {
        err.message.should.deep.equal(
          `The disk "disk" does not exist in "zone-a"`
        );
      }
      verify(compute.mocked.zone("zone-a")).once();
      verify(zone.mocked.disk("disk")).once();
      verify(disk.mocked.exists()).once();
      verify(disk.mocked.delete()).never();
    });
  });
});

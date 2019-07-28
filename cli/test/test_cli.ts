/* eslint-env mocha */

import * as chai from "chai";
import { Command } from "commander";
import { mock, instance, when, anything, verify, capture } from "ts-mockito";
import { GCP } from "../src/gcp";
import { Cli } from "../src/cli";
chai.should();

describe("#Cli", () => {
  describe("#getValue", () => {
    it("use the default value if command and config do not have a value", () => {
      const mockedGcp: GCP = mock(GCP);

      new Cli(instance(mockedGcp), "test", new Command(), {})
        .getValue("zone", "zone", "")
        .should.deep.equal("");
    });
    it("get the value from the config", () => {
      const mockedGcp: GCP = mock(GCP);

      new Cli(instance(mockedGcp), "test", new Command(), {
        zone: "zone"
      })
        .getValue("zone", "zone", "")
        .should.deep.equal("zone");
    });
    it("get the value from the command", () => {
      const mockedGcp: GCP = mock(GCP);
      const command = new Command();
      command.zone = "zone";
      new Cli(instance(mockedGcp), "test", command, {})
        .getValue("zone", "zone", "")
        .should.deep.equal("zone");
    });
    it("use the value from the command when both have the value", () => {
      const mockedGcp: GCP = mock(GCP);
      const command = new Command();
      command.zone = "zone";
      new Cli(instance(mockedGcp), "test", command, { zone: "test" })
        .getValue("zone", "zone", "")
        .should.deep.equal("zone");
    });
  });
  describe("#launch", () => {
    it("restore a disk, create a VM, and start the VM", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      await new Cli(instance(mockedGcp), "test", new Command(), {
        "machine-type": "n1-highmem-4",
        zone: "zone"
      }).launch();

      verify(mockedGcp.restoreDsik("test", "zone")).once();
      verify(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).once();
      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          "n1-highmem-4",
          { accelerators: [], tags: [], preemptible: false }
        ]);
      verify(mockedGcp.startMachine("test", "zone")).once();
    });
    it("use a custum machine type", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      await new Cli(instance(mockedGcp), "test", new Command(), {
        vcpu: 4,
        memory: 1,
        zone: "zone"
      }).launch();

      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          { vCPU: 4, memory: 1 },
          { accelerators: [], tags: [], preemptible: false }
        ]);
    });
    it("use a command to specify the machine type", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);
      const command = new Command();
      command.machineType = "n1-highmem-4";

      await new Cli(instance(mockedGcp), "test", command, {
        zone: "zone"
      }).launch();

      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          "n1-highmem-4",
          { accelerators: [], tags: [], preemptible: false }
        ]);
    });
    it("use a command to specify the custum amchine type", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      const command = new Command();
      command.vcpu = 4;
      command.memory = 1;

      await new Cli(instance(mockedGcp), "test", command, {
        zone: "zone"
      }).launch();

      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          { vCPU: 4, memory: 1 },
          { accelerators: [], tags: [], preemptible: false }
        ]);
    });
    it("use a command when both command and config specify the machine type", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      const command = new Command();
      command.vcpu = 4;
      command.memory = 1;

      await new Cli(instance(mockedGcp), "test", command, {
        zone: "zone",
        "machine-type": "n1-highmem-4"
      }).launch();

      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          { vCPU: 4, memory: 1 },
          { accelerators: [], tags: [], preemptible: false }
        ]);
    });
    it("add accelerators to the VM", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      await new Cli(instance(mockedGcp), "test", new Command(), {
        "machine-type": "n1-highmem-4",
        zone: "zone",
        accelerators: [{ deviceCount: "GPU", count: 1 }]
      }).launch();

      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          "n1-highmem-4",
          {
            accelerators: [{ deviceCount: "GPU", count: 1 }],
            tags: [],
            preemptible: false
          }
        ]);
    });
    it("add network tags to the VM", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      await new Cli(instance(mockedGcp), "test", new Command(), {
        "machine-type": "n1-highmem-4",
        zone: "zone",
        tags: ["tag"]
      }).launch();

      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          "n1-highmem-4",
          {
            accelerators: [],
            tags: ["tag"],
            preemptible: false
          }
        ]);
    });
    it("use preemptible instance", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.restoreDsik("test", "zone")).thenResolve(null);
      when(
        mockedGcp.createMachine("test", "test", "zone", anything(), anything())
      ).thenResolve(null);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      await new Cli(instance(mockedGcp), "test", new Command(), {
        "machine-type": "n1-highmem-4",
        zone: "zone",
        preemptible: true
      }).launch();

      capture(mockedGcp.createMachine)
        .last()
        .should.deep.equal([
          "test",
          "test",
          "zone",
          "n1-highmem-4",
          {
            accelerators: [],
            tags: [],
            preemptible: true
          }
        ]);
    });
  });
  describe("#resume", () => {
    it("start a VM", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.startMachine("test", "zone")).thenResolve(null);

      await new Cli(instance(mockedGcp), "test", new Command(), {
        zone: "zone"
      }).resume();

      verify(mockedGcp.startMachine("test", "zone")).once();
    });
  });
  describe("#pause", () => {
    it("stop a VM", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.stopMachine("test", "zone")).thenResolve(null);

      await new Cli(instance(mockedGcp), "test", new Command(), {
        zone: "zone"
      }).pause();

      verify(mockedGcp.stopMachine("test", "zone")).once();
    });
  });
  describe("#terminate", () => {
    it("stop a VM, delete the VM, and create a snapshot", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.stopMachine("test", "zone")).thenResolve(null);
      when(mockedGcp.deleteMachine("test", "zone")).thenResolve(null);
      when(mockedGcp.createSnapshot("test", anything(), "zone")).thenResolve(
        null
      );

      await new Cli(instance(mockedGcp), "test", new Command(), {
        zone: "zone"
      }).terminate();

      verify(mockedGcp.stopMachine("test", "zone")).once();
      verify(mockedGcp.deleteMachine("test", "zone")).once();
      verify(mockedGcp.createSnapshot("test", anything(), "zone")).once();
      capture(mockedGcp.createSnapshot)
        .last()[1]
        .startsWith("test-")
        .should.equal(true);
    });
  });
  describe("#ipAddress", () => {
    it("query the public IP address of the VM", async () => {
      const mockedGcp: GCP = mock(GCP);
      when(mockedGcp.getPublicIpAddress("test", "zone")).thenResolve("addr");

      const addr = await new Cli(instance(mockedGcp), "test", new Command(), {
        zone: "zone"
      }).ipAddress();
      addr.should.deep.equal("addr");
      verify(mockedGcp.getPublicIpAddress("test", "zone")).once();
    });
  });
});

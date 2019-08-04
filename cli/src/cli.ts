#! /usr/bin/env node

import * as program from "commander";
import * as log4js from "log4js";
import { Configurations } from "./configurations";
import { GCP, CustumMachineType, MachineOptions } from "./gcp";

const logger = log4js.getLogger();

export class Cli {
  public constructor(
    private gcp: GCP,
    private diskName: string,
    private command: program.Command,
    private configs: Configurations
  ) {}

  public getValue<V>(
    commandKey: string,
    configKey: string,
    defaultValue: V
  ): V {
    if (this.command[commandKey] !== undefined) {
      return this.command[commandKey];
    }
    if (this.configs[configKey] !== undefined) {
      return this.configs[configKey];
    }
    return defaultValue;
  }

  public async launch(): Promise<void> {
    // Parse arguments
    /* Get machine type */
    let machineType: string | CustumMachineType | null = null;
    /* From config file */
    if (this.configs["machine-type"]) {
      machineType = this.configs["machine-type"];
    } else if (
      this.configs["vcpu"] !== undefined &&
      this.configs["memory"] !== undefined
    ) {
      machineType = {
        vCPU: this.configs["vcpu"],
        memory: this.configs["memory"]
      };
    }
    /* From command line arguments */
    if (this.command.machineType) {
      machineType = this.command.machineType;
    } else if (
      this.command.vcpu !== undefined &&
      this.command.memory !== undefined
    ) {
      machineType = { vCPU: this.command.vcpu, memory: this.command.memory };
    }

    /* Get options */
    const options: MachineOptions = {
      accelerators: this.getValue("accelerators", "accelerators", []),
      preemptible: this.getValue("preemptible", "preemptible", false),
      tags: this.getValue("tags", "tags", [])
    };

    /* Get zone */
    const zone = this.getValue("zone", "zone", "");

    logger.debug(`The machineType: ${JSON.stringify(machineType)}`);
    logger.debug(`The MachineOptions: ${JSON.stringify(options)}`);
    logger.debug(`The zone: ${zone}`);

    // Create VM
    logger.info("Restore the disk from a snapshot if needed");
    await this.gcp.restoreDsik(this.diskName, zone);
    logger.info("Create VM");
    await this.gcp.createMachine(
      this.diskName,
      this.diskName,
      zone,
      machineType,
      options
    );

    // Resume VM
    await this.resume();
  }
  public async resume(): Promise<void> {
    /* Get zone */
    const zone = this.getValue("zone", "zone", "");

    logger.debug(`The zone: ${zone}`);

    logger.info("Start VM");
    await this.gcp.startMachine(this.diskName, zone);
  }
  public async pause(): Promise<void> {
    /* Get zone */
    const zone = this.getValue("zone", "zone", "");

    logger.debug(`The zone: ${zone}`);

    logger.info("Stop VM");
    await this.gcp.stopMachine(this.diskName, zone);
  }
  public async terminate(): Promise<void> {
    const date = new Date();
    const snapshotName =
      `${this.diskName}-` +
      `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-` +
      `${date.getTime().toString(16)}`;
    /* Get zone */
    const zone = this.getValue("zone", "zone", "");

    logger.debug(`The zone: ${zone}`);
    logger.debug(`The snapshotName: ${snapshotName}`);

    await this.pause();

    logger.info("Delete VM");
    await this.gcp.deleteMachine(this.diskName, zone);

    logger.info("Create a snapshot from the disk");
    await this.gcp.createSnapshot(this.diskName, snapshotName, zone);
  }
  public async ipAddress(): Promise<string> {
    /* Get zone */
    const zone = this.getValue("zone", "zone", "");

    logger.debug(`The zone: ${zone}`);

    return await this.gcp.getPublicIpAddress(this.diskName, zone);
  }
}

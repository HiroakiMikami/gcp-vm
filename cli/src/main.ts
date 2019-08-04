#! /usr/bin/env node

/* eslint no-console: 0 */

import * as program from "commander";
import * as log4js from "log4js";
import * as process from "process";
import * as path from "path";
import * as os from "os";
import { load, merge, Configurations } from "./configurations";
import { GCP, Accelerator } from "./gcp";
import { Cli } from "./cli";

const logger = log4js.getLogger();

export function parseAccelerator(value: string): readonly Accelerator[] {
  const accelerators = [];
  try {
    const xs = value.split(",");
    for (const x of xs) {
      if (x.length === 0) {
        continue;
      }
      const [type, count] = x.split("=");
      accelerators.push({ deviceType: type, count: parseInt(count, 10) });
    }
  } catch (error) {
    throw error;
  }
  return accelerators;
}

export function parseTags(value: string): readonly string[] {
  return value.split(",");
}
export function parseBoolean(value: string): boolean {
  if (value === "true") {
    return true;
  } else if (value === "false") {
    return false;
  } else {
    throw new Error(`The value is not boolean: ${value}`);
  }
}

function initialize(globalCommand: program.Command): GCP {
  logger.level = globalCommand.logLevel;

  process.env.GOOGLE_APPLICATION_CREDENTIALS =
    globalCommand.gcpApplicationCredentials;
  return new GCP({
    diskNameLabel: `${globalCommand.labelPrefix}__disk_name`,
    projectLabel: `${globalCommand.labelPrefix}__project`,
    diskTypeLabel: `${globalCommand.labelPrefix}__disk_type`
  });
}

async function loadLocalConfigs(
  configDir: string,
  diskName: string
): Promise<Configurations> {
  const localConfigPath = path.join(configDir, `${diskName}.json`);
  logger.info("Load the local config file");
  logger.debug(`The local config file: ${localConfigPath}`);
  return await load(localConfigPath);
}

async function main(): Promise<void> {
  try {
    logger.level = "trace";

    // Get the configuration directory
    const configDir =
      process.env.GCP_VM_CONFIG_DIR ||
      path.join(os.homedir(), ".config", "gcp-vm");
    const globalConfigPath = path.join(configDir, "global_config.json");

    // Load the global configuration file
    logger.info("Load the global config file");
    logger.debug(`The global config file: ${globalConfigPath}`);
    let globalConfig = await load(globalConfigPath);
    globalConfig = merge(
      {
        "gcp-application-credentials":
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          path.join(os.homedir(), ".gcp-vm.json"),
        "log-level": "info"
      },
      globalConfig
    );

    // Define global options
    program
      .version("0.0.0")
      .option(
        "--log-level <level>",
        "One of the followings: [trace, debug, info, warn, error, fatal]",
        globalConfig["log-level"]
      )
      .option(
        "--gcp-application-credentials <file>",
        "The path containing the credentials for GCP",
        globalConfig["gcp-application-credentials"]
      )
      .option(
        "--label-prefix <prefix>",
        "The prefix of the disk labels",
        "gcp_vm"
      );
    // Define command-specific options
    program
      .command("launch <disk>")
      .option("--zone", "The GCP zone")
      .option("--machine-type <machine_type>", "The machine type of VM")
      .option("--vcpu <n>", "The number of CPUs")
      .option("--vmemory <n>", "The size of the memory [GB]")
      .option(
        "--accelerator [type=count,...]",
        "The accelerators",
        parseAccelerator
      )
      .option(
        "--preemptible <true|false>",
        "Use preemptible VM or not",
        parseBoolean
      )
      .option("--tags <tag1>[,<tag2>...]", "The network tags", parseTags)
      .action(async (disk, cmd) => {
        const configs = await loadLocalConfigs(configDir, disk);
        await new Cli(initialize(program), disk, cmd, configs).launch();
      });
    program
      .command("resume <disk>")
      .option("--zone", "The GCP zone")
      .action(async (disk, cmd) => {
        const configs = await loadLocalConfigs(configDir, disk);
        await new Cli(initialize(program), disk, cmd, configs).resume();
      });
    program
      .command("pause <disk>")
      .option("--zone", "The GCP zone")
      .action(async function(disk, cmd) {
        const configs = await loadLocalConfigs(configDir, disk);
        await new Cli(initialize(program), disk, cmd, configs).pause();
      });
    program
      .command("terminate <disk>")
      .option("--zone", "The GCP zone")
      .action(async function(disk, cmd) {
        const configs = await loadLocalConfigs(configDir, disk);
        await new Cli(initialize(program), disk, cmd, configs).terminate();
      });
    program
      .command("ip-address <disk>")
      .option("--zone", "The GCP zone")
      .action(async function(disk, cmd) {
        const configs = await loadLocalConfigs(configDir, disk);
        const address = await new Cli(
          initialize(program),
          disk,
          cmd,
          configs
        ).ipAddress();
        console.log(`IpAddress: ${address}`);
      });
    program.parse(process.argv);
  } catch (error) {
    logger.error(error);
  }
}

main();

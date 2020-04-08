"use strict";

import * as clc from "cli-color";
import { Command } from "../command";
import * as commandUtils from "../emulator/commandUtils";
import * as FirestoreDelete from "../firestore/delete";
import { prompt } from "../prompt";
import { requirePermissions } from "../requirePermissions";
import * as utils from "../utils";

function getConfirmationMessage(deleteOp: FirestoreDelete, options: any) {
  if (options.allCollections) {
    return (
      "You are about to delete " +
      clc.bold.yellow.underline("THE ENTIRE DATABASE") +
      " for " +
      clc.cyan(options.project) +
      ". Are you sure?"
    );
  }

  if (deleteOp.isDocumentPath) {
    // Recursive document delete
    if (options.recursive) {
      return (
        "You are about to delete the document at " +
        clc.cyan(deleteOp.path) +
        " and all of its subcollections. Are you sure?"
      );
    }

    // Shallow document delete
    return "You are about to delete the document at " + clc.cyan(deleteOp.path) + ". Are you sure?";
  }

  // Recursive collection delete
  if (options.recursive) {
    return (
      "You are about to delete all documents in the collection at " +
      clc.cyan(deleteOp.path) +
      " and all of their subcollections. " +
      "Are you sure?"
    );
  }

  // Shallow collection delete
  return (
    "You are about to delete all documents in the collection at " +
    clc.cyan(deleteOp.path) +
    ". Are you sure?"
  );
}

module.exports = new Command("firestore:delete [path]")
  .description("Delete data from Cloud Firestore.")
  .option(
    "-r, --recursive",
    "Recursive. Delete all documents and subcollections. " +
      "Any action which would result in the deletion of child documents will fail if " +
      "this argument is not passed. May not be passed along with --shallow."
  )
  .option(
    "--shallow",
    "Shallow. Delete only parent documents and ignore documents in " +
      "subcollections. Any action which would orphan documents will fail if this argument " +
      "is not passed. May not be passed along with -r."
  )
  .option(
    "--all-collections",
    "Delete all. Deletes the entire Firestore database, " +
      "including all collections and documents. Any other flags or arguments will be ignored."
  )
  .option("-y, --yes", "No confirmation. Otherwise, a confirmation prompt will appear.")
  .before(commandUtils.warnFirestoreEmulated)
  .before(requirePermissions, ["datastore.entities.list", "datastore.entities.delete"])
  .action(async (path: string | undefined, options: any) => {
    // Guarantee path
    if (!path && !options.allCollections) {
      return utils.reject("Must specify a path.", { exit: 1 });
    }

    const deleteOp = new FirestoreDelete(options.project, path, {
      recursive: options.recursive,
      shallow: options.shallow,
      allCollections: options.allCollections,
    });

    if (!options.yes) {
      const res = await prompt(options, [
        {
          type: "confirm",
          name: "confirm",
          default: false,
          message: getConfirmationMessage(deleteOp, options),
        },
      ]);

      if (!res.confirm) {
        return utils.reject("Command aborted.", { exit: 1 });
      }
    }

    if (options.allCollections) {
      return deleteOp.deleteDatabase();
    }

    return deleteOp.execute();
  });
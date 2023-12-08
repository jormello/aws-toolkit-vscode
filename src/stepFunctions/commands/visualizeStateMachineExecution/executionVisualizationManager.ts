/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'

import { AbstractExecutionVisualizationManager as AbstractExecutionVisualizationManager } from './abstractExecutionVisualizationManager'
import { ExecutionVisualization } from './executionVisualization'
import { getLogger, Logger } from '../../../shared/logger'
import { DefaultStepFunctionsClient } from '../../../shared/clients/stepFunctionsClient'

export class ExecutionVisualizationManager extends AbstractExecutionVisualizationManager {
    protected readonly name: string = 'AslVisualizationManager'

    public constructor(extensionContext: vscode.ExtensionContext) {
        super(extensionContext)
    }

    public async visualizeStateMachineExecution(
        globalStorage: vscode.Memento,
        stateMachineExecutionArn: string
    ): Promise<vscode.WebviewPanel | undefined> {
        const logger: Logger = getLogger()

        // Attempt to retrieve existing visualization if it exists.
        const existingVisualization = this.getExistingVisualization(stateMachineExecutionArn)
        if (existingVisualization) {
            existingVisualization.showPanel()

            return existingVisualization.getPanel()
        }

        // Existing visualization does not exist, construct new visualization
        try {
            await this.updateCache(globalStorage, logger)

            const region = getRegionFromExecutionArn(stateMachineExecutionArn)
            const client = new DefaultStepFunctionsClient(region)

            const newVisualization = new ExecutionVisualization(stateMachineExecutionArn, client)
            this.handleNewVisualization(stateMachineExecutionArn, newVisualization)

            return newVisualization.getPanel()
        } catch (err) {
            this.handleErr(err as Error, logger)
        }
    }
}

function getRegionFromExecutionArn(executionArn: string) {
    // arn:aws:states:us-east-1:757728263703:execution:MyStateMachine-uik5zsjxc:abc
    return executionArn.split(':')[3]
}

/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import * as nls from 'vscode-nls'
import { getLogger, Logger } from '../../../shared/logger'
import { showViewLogsMessage } from '../../../shared/utilities/messages'
import { VisualizeStateMachineExecutionWizard } from '../../wizards/visualizeStateMachineExecutionWizard'
import { ExecutionVisualizationManager } from './executionVisualizationManager'
const localize = nls.loadMessageBundle()

export async function visualizeStateMachineExecution(
    executionVisualizationManager: ExecutionVisualizationManager,
    outputChannel: vscode.OutputChannel,
    globalStorage: vscode.Memento
) {
    const logger: Logger = getLogger()

    try {
        // const response = await new VisualizeStateMachineExecutionWizard().run()
        // if (!response) {
        //     return
        // }
        // if (response?.stateMachineExecutionArn) {
        //     await createExecutionGraph(executionVisualizationManager, response.stateMachineExecutionArn, outputChannel, globalStorage)
        // }
        await createExecutionGraph(
            executionVisualizationManager,
            'arn:aws:states:us-east-1:757728263703:execution:MyStateMachine-2bxl6k7mj:8be30b6a-0da5-4319-ad6f-f59768af4936',
            outputChannel,
            globalStorage
        )
    } catch (err) {
        logger.error(err as Error)
    }
}

async function createExecutionGraph(
    executionVisualizationManager: ExecutionVisualizationManager,
    stateMachineExecutionArn: string,
    outputChannel: vscode.OutputChannel,
    globalStorage: vscode.Memento
) {
    const logger: Logger = getLogger()
    logger.info(`Visualizing state machine execution '${stateMachineExecutionArn}'`)
    outputChannel.show()
    outputChannel.appendLine(
        localize(
            'AWS.message.info.stepFunctions.visualizeStateMachineExecution.creating',
            "Visualizing state machine execution '{0}'...",
            stateMachineExecutionArn
        )
    )
    outputChannel.appendLine('')
    try {
        executionVisualizationManager.visualizeStateMachineExecution(globalStorage, stateMachineExecutionArn)
    } catch (err) {
        const msg = localize(
            'AWS.message.error.stepFunctions.visualizeStateMachineExecution.createFailure',
            'Failed to visualize state machine execution: {0}',
            stateMachineExecutionArn
        )
        showViewLogsMessage(msg)
        outputChannel.appendLine(msg)
        outputChannel.appendLine('')
        logger.error(`Failed to visualize state machine execution '${stateMachineExecutionArn}': %O`, err as Error)
    }
}

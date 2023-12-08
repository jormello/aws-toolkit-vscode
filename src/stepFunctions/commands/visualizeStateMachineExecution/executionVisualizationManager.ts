/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import * as nls from 'vscode-nls'

import { ExecutionVisualization } from './executionVisualization'
import { getLogger, Logger } from '../../../shared/logger'
import { DefaultStepFunctionsClient } from '../../../shared/clients/stepFunctionsClient'
import { StateMachineGraphCache } from '../../utils'

const localize = nls.loadMessageBundle()

export class ExecutionVisualizationManager {
    private readonly managedVisualizations = new Map<string, ExecutionVisualization>()
    private readonly cache = new StateMachineGraphCache()
    private readonly extensionContext: vscode.ExtensionContext

    public constructor(extensionContext: vscode.ExtensionContext) {
        this.extensionContext = extensionContext
    }

    public async visualizeStateMachineExecution(
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
            await this.updateCache(this.extensionContext.globalState, logger)

            const region = getRegionFromExecutionArn(stateMachineExecutionArn)
            const client = new DefaultStepFunctionsClient(region)

            const newVisualization = new ExecutionVisualization(stateMachineExecutionArn, client)
            this.handleNewVisualization(stateMachineExecutionArn, newVisualization)

            return newVisualization.getPanel()
        } catch (err) {
            this.handleErr(err as Error, logger)
        }
    }

    private async updateCache(globalStorage: vscode.Memento, logger: Logger): Promise<void> {
        try {
            await this.cache.updateCache(globalStorage)
        } catch (err) {
            // So we can't update the cache, but can we use an existing on disk version.
            logger.warn('Updating State Machine Graph Visualisation assets failed, checking for fallback local cache.')
            await this.cache.confirmCacheExists()
        }
    }

    public getManagedVisualizations(): Map<string, ExecutionVisualization> {
        return this.managedVisualizations
    }

    private getExistingVisualization(key: string): ExecutionVisualization | undefined {
        return this.managedVisualizations.get(key)
    }

    private handleNewVisualization(key: string, visualization: ExecutionVisualization): void {
        this.managedVisualizations.set(key, visualization)

        const visualizationDisposable = visualization.onVisualizationDisposeEvent(() => {
            this.managedVisualizations.delete(key)
        })
        this.pushToExtensionContextSubscriptions(visualizationDisposable)
    }

    private pushToExtensionContextSubscriptions(visualizationDisposable: vscode.Disposable): void {
        this.extensionContext.subscriptions.push(visualizationDisposable)
    }

    private handleErr(err: Error, logger: Logger): void {
        vscode.window.showInformationMessage(
            localize(
                'AWS.stepfunctions.visualisation.errors.rendering',
                'There was an error rendering State Machine Execution Graph, check logs for details.'
            )
        )
    }
}

function getRegionFromExecutionArn(executionArn: string) {
    // arn:aws:states:us-east-1:757728263703:execution:MyStateMachine-uik5zsjxc:abc
    return executionArn.split(':')[3]
}

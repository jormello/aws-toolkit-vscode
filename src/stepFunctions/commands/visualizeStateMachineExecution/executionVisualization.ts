/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()
import * as vscode from 'vscode'
import { StepFunctions } from 'aws-sdk'
import { getLogger, Logger } from '../../../shared/logger'

import globals from '../../../shared/extensionGlobals'
import { DefaultStepFunctionsClient } from '../../../shared/clients/stepFunctionsClient'

export interface MessageObject {
    command: string
    text: string
    error?: string
    stateMachineData: string
}

export class ExecutionVisualization {
    public readonly stateMachineExecutionArn: string

    public readonly webviewPanel: vscode.WebviewPanel
    protected readonly disposables: vscode.Disposable[] = []
    protected isPanelDisposed = false
    private stateMachineDefinition: string | undefined
    private updateExecutionGraphTimeoutId: NodeJS.Timeout | undefined
    private readonly client: DefaultStepFunctionsClient
    private readonly onVisualizationDisposeEmitter = new vscode.EventEmitter<void>()

    public constructor(stateMachineExecutionArn: string, client: DefaultStepFunctionsClient) {
        this.stateMachineExecutionArn = stateMachineExecutionArn
        this.client = client
        this.webviewPanel = this.setupWebviewPanel(stateMachineExecutionArn)
    }

    public get onVisualizationDisposeEvent(): vscode.Event<void> {
        return this.onVisualizationDisposeEmitter.event
    }

    public getPanel(): vscode.WebviewPanel | undefined {
        if (!this.isPanelDisposed) {
            return this.webviewPanel
        }
    }

    public getWebview(): vscode.Webview | undefined {
        if (!this.isPanelDisposed) {
            return this.webviewPanel?.webview
        }
    }

    public showPanel(): void {
        this.getPanel()?.reveal()
    }

    public async sendUpdateMessage(
        stateMachineData: string,
        executionEvents: StepFunctions.HistoryEventList,
        executionStatus: string
    ) {
        const logger: Logger = getLogger()

        const webview = this.getWebview()
        if (this.isPanelDisposed || !webview) {
            return
        }

        const events = { events: executionEvents }

        logger.debug('Sending update message to webview.')
        webview.postMessage({
            command: 'update',
            stateMachineData,
            executionEvents: events,
            executionStatus,
        })
    }

    private async getUpdatedExecutionHistory(): Promise<StepFunctions.HistoryEventList> {
        const executionHistoryOutput: StepFunctions.GetExecutionHistoryOutput = await this.client.getExecutionHistory(
            this.stateMachineExecutionArn,
            false,
            undefined
        )
        // TODO handle over 1k events
        return executionHistoryOutput.events
    }

    private async getUpdatedExecutionStatus(): Promise<string> {
        const describeExecutionOutput: StepFunctions.DescribeExecutionOutput = await this.client.describeExecution(
            this.stateMachineExecutionArn
        )
        return describeExecutionOutput.status
    }

    private async getStateMachineDefinition(): Promise<string> {
        const describeStateMachineForExecutionOutput: StepFunctions.DescribeStateMachineForExecutionOutput =
            await this.client.describeStateMachineForExecution(this.stateMachineExecutionArn)
        return describeStateMachineForExecutionOutput.definition
    }

    private async updateExecutionGraph() {
        if (!this.stateMachineDefinition) {
            this.stateMachineDefinition = await this.getStateMachineDefinition()
        }

        const events = await this.getUpdatedExecutionHistory()
        const status = await this.getUpdatedExecutionStatus()

        // Stop refreshing the graph once the execution completes
        if (status !== 'RUNNING') {
            clearTimeout(this.updateExecutionGraphTimeoutId)
            setInterval(() => {
                this.updateExecutionGraph()
            }, 5000)
        }

        await this.sendUpdateMessage(this.stateMachineDefinition, events, status)
    }

    private setupWebviewPanel(stateMachineExecutionArn: string): vscode.WebviewPanel {
        const logger: Logger = getLogger()

        // Create and show panel
        const panel = this.createVisualizationWebviewPanel(stateMachineExecutionArn)

        const executionId = this.stateMachineExecutionArn.split(':')[7]
        const stateMachineName = this.stateMachineExecutionArn.split(':')[6]
        const region = this.stateMachineExecutionArn.split(':')[3]

        // Set the initial html for the webpage
        panel.webview.html = this.getWebviewContent(
            panel.webview.asWebviewUri(globals.visualizationResourcePaths.executionWebviewBodyScript),
            panel.webview.asWebviewUri(globals.visualizationResourcePaths.visualizationLibraryScript),
            panel.webview.asWebviewUri(globals.visualizationResourcePaths.visualizationLibraryCSS),
            panel.webview.asWebviewUri(globals.visualizationResourcePaths.stateMachineExecutionCustomThemeCSS),
            panel.webview.cspSource,
            `Visualizing executionId "${executionId}" for "${stateMachineName}" in "${region}"`
        )

        // Handle messages from the webview
        this.disposables.push(
            panel.webview.onDidReceiveMessage(async (message: MessageObject) => {
                switch (message.command) {
                    case 'updateResult':
                        logger.debug(message.text)
                        if (message.error) {
                            logger.error(message.error)
                        }
                        break
                    case 'webviewRendered': {
                        // Webview has finished rendering, so now we can give it our
                        // initial state machine definition.
                        this.updateExecutionGraph()
                        this.updateExecutionGraphTimeoutId = setInterval(() => {
                            this.updateExecutionGraph()
                        }, 1000)
                        break
                    }
                }
            })
        )

        // When the panel is closed, dispose of any disposables/remove subscriptions
        const disposePanel = () => {
            if (this.isPanelDisposed) {
                return
            }
            this.isPanelDisposed = true
            this.onVisualizationDisposeEmitter.fire()
            this.disposables.forEach(disposable => {
                disposable.dispose()
            })
            this.onVisualizationDisposeEmitter.dispose()
        }

        this.disposables.push(
            panel.onDidDispose(() => {
                disposePanel()
            })
        )

        return panel
    }

    private createVisualizationWebviewPanel(stateMachineExecutionArn: string): vscode.WebviewPanel {
        return vscode.window.createWebviewPanel(
            'stateMachineExecutionVisualization',
            localize('AWS.stepFunctions.executionGraph.titlePrefix', 'Graph: {0}', stateMachineExecutionArn),
            {
                preserveFocus: true,
                viewColumn: vscode.ViewColumn.Beside,
            },
            {
                enableScripts: true,
                localResourceRoots: [
                    globals.visualizationResourcePaths.localWebviewScriptsPath,
                    globals.visualizationResourcePaths.visualizationLibraryCachePath,
                    globals.visualizationResourcePaths.stateMachineCustomThemePath,
                ],
                retainContextWhenHidden: true,
            }
        )
    }

    private getWebviewContent(
        webviewBodyScript: vscode.Uri, // globals.visualizationResourcePaths.webviewBodyScript //  resources/js/graphStateMachine.js
        graphStateMachineLibrary: vscode.Uri, // globals.visualizationResourcePaths.visualizationLibraryScript // graph.js (from visualizationLibraryCachePath)
        vsCodeCustomStyling: vscode.Uri, // globals.visualizationResourcePaths.visualizationLibraryCSS  // graph.css (from visualizationLibraryCachePath)
        graphStateMachineDefaultStyles: vscode.Uri, // globals.visualizationResourcePaths.stateMachineCustomThemeCSS // resources/css/stateMachineRender.css
        cspSource: string, // panel.webview.cspSource
        statusTexts: string
    ): string {
        return `
    <!DOCTYPE html>
    <html>
        <head>
            <meta http-equiv="Content-Security-Policy"
            content="default-src 'none';
            img-src ${cspSource} https: data:;
            script-src ${cspSource} 'self';
            style-src ${cspSource};"
            >
            <meta charset="UTF-8">
            <link rel="stylesheet" href='${graphStateMachineDefaultStyles}'>
            <link rel="stylesheet" href='${vsCodeCustomStyling}'>
            <script src='${graphStateMachineLibrary}'></script>
        </head>

        <body>
            <div id="svgcontainer" class="workflowgraph">
                <svg></svg>
            </div>
            <div class="status-info">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="42" stroke-width="4" />
                </svg>
                <div class="status-messages">
                    <span class="execution-running-message">${statusTexts}</span>
                </div>
            </div>
            <div class="graph-buttons-container">
                <button id="zoomin">
                    <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                        <line x1="8" y1="1" x2="8" y2="15"></line>
                        <line x1="15" y1="8" x2="1" y2="8"></line>
                    </svg>
                </button>
                <button id="zoomout">
                    <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                        <line x1="15" y1="8" x2="1" y2="8"></line>
                    </svg>
                </button>
                <button id="center">
                    <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="7" stroke-width="2" />
                        <circle cx="8" cy="8" r="1" stroke-width="2" />
                    </svg>
                </button>
            </div>

            <script src='${webviewBodyScript}'></script>
        </body>
    </html>`
    }
}

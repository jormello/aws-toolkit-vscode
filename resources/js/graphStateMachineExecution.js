/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const vscode = acquireVsCodeApi()

let containerId = '#svgcontainer'
let graph

function renderStateMachineExecution(data, events) {
    let options = {
        width: window.innerWidth,
        height: window.innerHeight,
        resizeHeight: false,
    }
    graph = new sfn.StateMachineExecutionGraph(JSON.parse(data), events, containerId, options)
    graph.render()
}

const centerBtn = document.getElementById('center')
const zoominBtn = document.getElementById('zoomin')
const zoomoutBtn = document.getElementById('zoomout')
let lastStateMachineData
let lastExecutionHistory

function updateGraph(message) {
    statusInfoContainer.classList.remove('in-sync-asl', 'not-in-sync-asl', 'start-error-asl')
    statusInfoContainer.classList.add('syncing-asl')

    if (message.executionStatus === 'RUNNING') {
        statusInfoContainer.classList.remove('execution-succeeded-status', 'execution-failed-status')
        statusInfoContainer.classList.add('execution-running-status')
    }

    if (message.executionStatus === 'SUCCEEDED') {
        statusInfoContainer.classList.remove('execution-running-status', 'execution-failed-status')
        statusInfoContainer.classList.add('execution-succeeded-status')
    }

    if (message.executionStatus === 'FAILED') {
        statusInfoContainer.classList.remove('execution-running-status', 'execution-succeeded-status')
        statusInfoContainer.classList.add('execution-failed-status')
    }

    try {
        renderStateMachineExecution(message.stateMachineData, message.executionEvents)

        vscode.postMessage({
            command: 'updateResult',
            text: 'Successfully updated state machine execution graph.',
            stateMachineData: message.stateMachineData,
            executionEvents: message.executionEvents,
        })
        statusInfoContainer.classList.remove('syncing-asl', 'not-in-sync-asl', 'start-error-asl')
        statusInfoContainer.classList.add('in-sync-asl')
        hasRenderedOnce = true
        lastStateMachineData = message.stateMachineData
        lastExecutionHistory = message.executionEvents
    } catch (err) {
        console.log(err)
    }
}

const statusInfoContainer = document.querySelector('.status-info')
const previewButton = document.querySelector('.previewing-asl-message a')
let hasRenderedOnce = false

if (previewButton) {
    previewButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'viewDocument' })
    })
}

centerBtn.addEventListener('click', () => {
    if (lastStateMachineData && lastExecutionHistory) {
        renderStateMachineExecution(lastStateMachineData, lastExecutionHistory)
    }
})

zoominBtn.addEventListener('click', () => {
    if (graph) {
        graph.zoomIn()
    }
})

zoomoutBtn.addEventListener('click', () => {
    if (graph) {
        graph.zoomOut()
    }
})

// Message passing from extension to webview.
// Capture state machine definition
window.addEventListener('message', event => {
    // event.data is object passed in from postMessage from vscode
    const message = event.data
    switch (message.command) {
        case 'update': {
            updateGraph(message)
            break
        }
    }
})

// Let vscode know that the webview is finished rendering
vscode.postMessage({
    command: 'webviewRendered',
    text: 'Webivew has finished rendering and is visible',
})

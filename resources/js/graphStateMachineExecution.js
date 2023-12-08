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

    if (message.executionStatus === 'IN_PROGRESS') {
        statusInfoContainer.classList.remove('syncing-asl', 'in-sync-asl', 'start-error-asl')

        if (hasRenderedOnce) {
            statusInfoContainer.classList.add('not-in-sync-asl')
        } else {
            statusInfoContainer.classList.add('start-error-asl')
        }

        return
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
        console.log('Error parsing state machine definition.')
        console.log(err)

        vscode.postMessage({
            command: 'updateResult',
            text: 'Error parsing state machine definition.',
            error: err.toString(),
            stateMachineData: message.stateMachineData,
            executionEvents: message.executionEvents,
        })

        statusInfoContainer.classList.remove('syncing-asl', 'in-sync-asl', 'start-error-asl')

        if (hasRenderedOnce) {
            statusInfoContainer.classList.add('not-in-sync-asl')
        } else {
            statusInfoContainer.classList.add('start-error-asl')
        }
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

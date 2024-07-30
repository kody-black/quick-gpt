let conversationHistory = [];
let selectedModel = '';
let currentAssistantResponse = '';
let assistantDiv;
let reader;
let isStreaming = false; // 是否正在流式传输
let onPause = false;  // 是否处于暂停状态

function populateSelects() {
    console.log('populateSelects');
    const baseUrlSelect = document.getElementById('base-url');
    const apiKeySelect = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');

    // Clear existing options
    baseUrlSelect.innerHTML = '';
    apiKeySelect.innerHTML = '';

    // Populate selects
    for (const key in API_CONFIG) {
        const service = API_CONFIG[key];
        const option1 = document.createElement('option');
        option1.value = service.baseUrl;
        option1.text = service.baseUrl;
        baseUrlSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = service.apiKey;
        option2.text = key;
        apiKeySelect.appendChild(option2);
    }

    // Set default values
    const defaultServiceKey = Object.keys(API_CONFIG)[0];
    const defaultService = API_CONFIG[defaultServiceKey];
    baseUrlSelect.value = defaultService.baseUrl;
    apiKeySelect.value = defaultService.apiKey;
    selectedModel = defaultService.defaultModel;

    baseUrlSelect.addEventListener('change', function () {
        const selectedBaseUrl = baseUrlSelect.value;
        for (const key in API_CONFIG) {
            if (API_CONFIG[key].baseUrl === selectedBaseUrl) {
                apiKeySelect.value = API_CONFIG[key].apiKey;
                selectedModel = API_CONFIG[key].defaultModel;
                break;
            }
        }
        refreshModels();
    });
}

async function loadModels() {
    console.log('loadModels');
    const baseUrl = document.getElementById('base-url').value;
    const apiKey = document.getElementById('api-key').value;
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            authorization: `Bearer ${apiKey}`
        }
    };

    try {
        const response = await fetch(`${baseUrl}/models`, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const data = await response.json();
        const modelSelect = document.getElementById('model-select');
        modelSelect.innerHTML = ''; // Clear existing options
        data.data.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.text = model.id;
            if (model.id === selectedModel) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });
        modelSelect.addEventListener('change', (event) => {
            selectedModel = event.target.value;
        });
        // 将光标移动到问题输入框
        document.getElementById('question').focus();
    } catch (err) {
        console.error('加载模型失败, 请检查网络或配置文件 ', err);
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = '加载模型失败, 请检查网络或配置文件(utools中搜索gptconfig打开)<br>' + err;
        outputDiv.scrollTop = outputDiv.scrollHeight;
    }
}

function askGPT(continueSession = false) {
    const question = document.getElementById('question').value;
    const actionButton = document.getElementById('action-button');

    if (!question.trim() && !continueSession) {
        return;
    }

    if (!continueSession) {
        conversationHistory.push({
            role: 'user',
            content: question
        });
        outMessages = conversationHistory;
        isPausing = false;
    }
    else {
        // outMessages = conversationHistory;
        // 这里的outMessages不能直接使用conversationHistory，因为后续会修改conversationHistory
        outMessages = conversationHistory.slice();
        outMessages.push({
            role: 'user',
            content: 'continue'
        });
    }

    const baseUrl = document.getElementById('base-url').value;
    const apiKey = document.getElementById('api-key').value;
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: selectedModel,
            messages: outMessages,
            stream: true
        })
    };

    fetch(`${baseUrl}/chat/completions`, options)
        .then(response => response.body)
        .then(body => {
            reader = body.getReader();
            isStreaming = true;
            actionButton.innerText = '停止';
            return new ReadableStream({
                start(controller) {
                    function push() {
                        reader.read().then(({ done, value }) => {
                            console.log('done:', done, 'value:', value);
                            if (done) {
                                controller.close();
                                isStreaming = false;
                                // 检查是否处于暂停状态
                                if (isPausing) {
                                    actionButton.innerText = '继续';
                                } else {
                                    actionButton.innerText = '确定';
                                }
                                isPausing = false;
                                console.log('流式传输已完成');
                                return;
                            }
                            const textDecoder = new TextDecoder();
                            const chunk = textDecoder.decode(value);
                            handleStreamedResponse(chunk, continueSession = continueSession);
                            push();
                        }).catch(err => {
                            console.error('读取失败:', err);
                            controller.error(err);
                            isStreaming = false;
                            actionButton.innerText = '确定';
                        });
                    }
                    push();
                }
            });
        })
        .catch(err => {
            console.error('发生错误:', err);
            isStreaming = false;
            actionButton.innerText = '确定';
            alert('发生错误:', err);
        });
}

function handleStreamedResponse(chunk, continueSession = false) {
    console.log('handleStreamedResponse');
    const lines = chunk.split('\n').filter(line => line.trim() !== '');
    const model_name = document.getElementById('model-select').value;
    lines.forEach(line => {
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
            // 如果continueSession是true，则应该将获取的内容添加到在conversationHistory的最后一条消息中的content后面
            if (continueSession) {
                conversationHistory[conversationHistory.length - 1].content += currentAssistantResponse;
            } else {
                conversationHistory.push({
                    role: 'assistant',
                    content: currentAssistantResponse
                });
            }
            currentAssistantResponse = '';
            assistantDiv = null; // Reset assistantDiv after done
            displayConversationHistory();
        } else {
            try {
                const response = JSON.parse(message);
                if (response.choices && response.choices[0].delta && response.choices[0].delta.content) {
                    const content = response.choices[0].delta.content;
                    currentAssistantResponse += content;
                    if (!assistantDiv) {
                        assistantDiv = document.createElement('div');
                        assistantDiv.innerHTML = `<strong>${model_name}:</strong>`;
                        document.getElementById('output').appendChild(assistantDiv);
                    }
                    assistantDiv.innerHTML += content.replace(/\n/g, '<br>'); // 将换行替换为<br>
                }
            } catch (err) {
                console.error('数据流处理失败:\n', err);
            }
        }
    });
    const outputDiv = document.getElementById('output');
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

function displayConversationHistory() {
    console.log('displayConversationHistory');
    const outputDiv = document.getElementById('output');
    const model_name = document.getElementById('model-select').value;
    outputDiv.innerHTML = '';
    conversationHistory.forEach(entry => {
        const entryDiv = document.createElement('div');
        if (entry.role === 'user') {
            entryDiv.innerHTML = `<strong>${USER_NAME}:</strong> ${entry.content}`;
        } else {
            entryDiv.innerHTML = `<strong>${model_name}:</strong> ${marked.parse(entry.content)}`;
            addCopyButtons(entryDiv); // 添加复制按钮
        }
        outputDiv.appendChild(entryDiv);
    });
    document.getElementById('question').value = '';
    MathJax.typesetPromise();
    hljs.highlightAll(); // 添加这一行来高亮代码
}

function addCopyButtons(container) {
    console.log('addCopyButtons');
    container.querySelectorAll('pre code').forEach((codeBlock) => {
        const button = document.createElement('button');
        button.className = 'copy-btn';
        button.innerText = '复制';
        button.setAttribute('data-clipboard-text', codeBlock.innerText);
        codeBlock.parentNode.insertBefore(button, codeBlock); // 将按钮插入到 codeBlock 的父节点中，位于 codeBlock 前面
    });

    const clipboard = new ClipboardJS('.copy-btn');
    clipboard.on('success', function (e) {
        e.trigger.innerText = '复制成功';
        setTimeout(() => {
            e.trigger.innerText = '复制';
        }, 2000);
    });
    clipboard.on('error', function (e) {
        e.trigger.innerText = '复制失败';
        setTimeout(() => {
            e.trigger.innerText = '复制';
        }, 2000);
    });
}

function refreshModels() {
    console.log('refreshModels');
    // 清空对话历史
    conversationHistory = [];
    currentAssistantResponse = '';
    assistantDiv = null;
    document.getElementById('output').innerHTML = '';
    document.getElementById('action-button').innerText = '确定';
    loadModels();
}


function reset() {
    console.log('reset');
    window.loadConfig();
    populateSelects();
    refreshModels();
}

function stopStream() {
    console.log('stopStream');
    if (reader) {
        reader.cancel();
        isStreaming = false;
        const actionButton = document.getElementById('action-button');
        actionButton.innerText = '继续';
        console.log('当前状态:', isPausing);
        if (isPausing) {
            //  如果处于暂停状态，则将当前assistantResponse添加到conversationHistory的最后一条消息中的content后面
            lastAssistantResponse = conversationHistory[conversationHistory.length - 1].content;
            conversationHistory[conversationHistory.length - 1].content += currentAssistantResponse;
            displayConversationHistory();
            // 显示后重新使得conversationHistory的最后一条消息恢复到添加assistantResponse之前的状态
            conversationHistory[conversationHistory.length - 1].content = lastAssistantResponse;
        }
        else {
            conversationHistory.push({
                role: 'assistant',
                content: currentAssistantResponse
            });
            displayConversationHistory();
            currentAssistantResponse = '';
            assistantDiv = null;
        }
        isPausing = true;
    }
}

function handleAction() {
    const actionButton = document.getElementById('action-button');
    if (actionButton.innerText === '停止') {
        stopStream();
    } else if (actionButton.innerText === '继续') {
        askGPT(true); // 继续当前对话
    } else {
        askGPT();
    }
}
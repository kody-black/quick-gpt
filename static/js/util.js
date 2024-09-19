let conversationHistory = [];
let selectedModel = '';
let currentAssistantResponse = '';
let assistantDiv;
let reader;
let isStreaming = false;
let isPausing = false;

function populateSelects() {
    const baseUrlSelect = document.getElementById('base-url');
    const apiKeySelect = document.getElementById('api-key');

    baseUrlSelect.innerHTML = '';
    apiKeySelect.innerHTML = '';

    Object.entries(API_CONFIG).forEach(([key, service]) => {
        baseUrlSelect.appendChild(createOption(service.baseUrl, service.baseUrl));
        apiKeySelect.appendChild(createOption(service.apiKey, key));
    });

    const [defaultServiceKey] = Object.keys(API_CONFIG);
    const defaultService = API_CONFIG[defaultServiceKey];
    baseUrlSelect.value = defaultService.baseUrl;
    apiKeySelect.value = defaultService.apiKey;
    selectedModel = defaultService.defaultModel;

    baseUrlSelect.addEventListener('change', updateApiKeyAndModel);
}

function createOption(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.text = text;
    return option;
}

function updateApiKeyAndModel() {
    const selectedBaseUrl = document.getElementById('base-url').value;
    const service = Object.values(API_CONFIG).find(s => s.baseUrl === selectedBaseUrl);
    if (service) {
        document.getElementById('api-key').value = service.apiKey;
        selectedModel = service.defaultModel;
    }
    refreshModels();
}

async function loadModels() {
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
            throw new Error(`HTTP错误! 状态: ${response.status}, 信息: ${await response.text()}`);
        }
        const data = await response.json();
        updateModelSelect(data.data);
    } catch (err) {
        handleFetchError(err);
    }
}

function updateModelSelect(models) {
    const modelSelect = document.getElementById('model-select');
    modelSelect.innerHTML = '';
    models.forEach(model => {
        const option = createOption(model.id, model.id);
        if (model.id === selectedModel) {
            option.selected = true;
        }
        modelSelect.appendChild(option);
    });
    modelSelect.addEventListener('change', (event) => {
        selectedModel = event.target.value;
    });
    document.getElementById('question').focus();
}

function waitForCondition(callback) {
    if (isPausing && reader) {
        setTimeout(() => waitForCondition(callback), 500);
    } else {
        callback();
    }
}

function askGPT() {
    const question = document.getElementById('question').value.trim();
    if (!question) return;

    conversationHistory.push({ role: 'user', content: question });

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
            messages: conversationHistory,
            stream: true
        })
    };
    fetch(`${baseUrl}/chat/completions`, options)
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || '对话请求失败');
                });
            }
            return response.body;
        })
        .then(body => {
            reader = body.getReader();
            isStreaming = true;
            return new ReadableStream({
                start(controller) {
                    function push() {
                        waitForCondition(() => {
                            document.getElementById('action-button').innerText = '暂停';
                            reader.read().then(({ done, value }) => {
                                if (done) {
                                    controller.close();
                                    finishStreaming();
                                    return;
                                }
                                const chunk = new TextDecoder().decode(value);
                                handleStreamedResponse(chunk);
                                push();
                            }).catch(handleStreamError);
                        });
                    }
                    push();
                }
            });
        })
        .catch(handleFetchError);
}

function finishStreaming() {
    isStreaming = false;
    document.getElementById('action-button').innerText = '发送';
}

function handleStreamError(err) {
    console.error('读取失败:', err);
    isStreaming = false;
    document.getElementById('action-button').innerText = '发送';
}

function handleFetchError(err) {
    console.error('发生错误:', err);
    isStreaming = false;
    document.getElementById('action-button').innerText = '发送';
    
    const outputDiv = document.getElementById('output');
    // 创建一个div元素，属于error类
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.innerText = `发生错误: ${err}`;
    outputDiv.appendChild(errorDiv);
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

function handleStreamedResponse(chunk) {
    const lines = chunk.split('\n').filter(line => line.trim() !== '');
    const model_name = document.getElementById('model-select').value;
    const outputDiv = document.getElementById('output');

    lines.forEach(line => {
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
            finishAssistantResponse();
        } else {
            try {
                const response = JSON.parse(message);
                if (response.choices && response.choices[0].delta && response.choices[0].delta.content) {
                    updateAssistantResponse(response.choices[0].delta.content, model_name);
                }
            } catch (err) {
                console.error('数据流处理失败:\n', err);
            }
        }
    });
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

function finishAssistantResponse() {
    conversationHistory.push({
        role: 'assistant',
        content: currentAssistantResponse
    });
    addCopyButtons(assistantDiv, currentAssistantResponse);
    currentAssistantResponse = '';
    assistantDiv = null;
}

function updateAssistantResponse(content, model_name) {
    currentAssistantResponse += content;
    if (!assistantDiv) {
        createNewConversation();
    }
    assistantDiv.innerHTML = `${model_name}: ${marked.parse(currentAssistantResponse)}`;
    assistantDiv.querySelectorAll('pre code').forEach((codeBlock) => {
        hljs.highlightElement(codeBlock);
    });
}

function createNewConversation() {
    const question = document.getElementById('question').value;
    const conversationDiv = document.createElement('div');
    conversationDiv.className = 'conversation';

    const userDiv = document.createElement('div');
    userDiv.innerText = `${USER_NAME}: ${question}\n\n`;
    conversationDiv.appendChild(userDiv);

    assistantDiv = document.createElement('div');
    conversationDiv.appendChild(assistantDiv);

    document.getElementById('output').appendChild(conversationDiv);
    document.getElementById('question').value = '';
}

function addCopyButtons(container, content) {
    const button = document.createElement('button');
    button.className = 'copy-btn';
    button.innerText = '复制回答';
    button.setAttribute('data-clipboard-text', content);
    container.appendChild(button);

    const clipboard = new ClipboardJS('.copy-btn');
    clipboard.on('success', (e) => updateButtonText(e.trigger, '复制成功'));
    clipboard.on('error', (e) => updateButtonText(e.trigger, '复制失败'));
}

function updateButtonText(button, text) {
    button.innerText = text;
    setTimeout(() => {
        button.innerText = '复制回答';
    }, 2000);
}

function newChat() {
    conversationHistory = [];
    document.getElementById('output').innerHTML = '';
    document.getElementById('question').focus();
    refreshModels();
}

function refreshModels() {
    if (isStreaming) {
        stopStream();
    }
    
    // 删除掉outputDiv中的所有errorDiv
    const outputDiv = document.getElementById('output');
    const errorDivs = outputDiv.querySelectorAll('.error');
    errorDivs.forEach(div => outputDiv.removeChild(div));
    loadModels();
}

function reset() {
    window.loadConfig();
    populateSelects();
    newChat();
}

function stopStream() {
    if (reader) {
        reader.cancel();
        isStreaming = false;
        isPausing = false;
        document.getElementById('action-button').innerText = '发送';
        conversationHistory.push({
            role: 'assistant',
            content: currentAssistantResponse
        });
        currentAssistantResponse = '';
        assistantDiv = null;
    }
}

function pauseStream() {
    if (reader) {
        isPausing = true;
        document.getElementById('action-button').innerText = '继续';
        setTimeout(() => {
            addCopyButtons(assistantDiv, currentAssistantResponse);
        }, 500);
    }
}

function resumeStream() {
    if (reader) {
        isPausing = false;
        document.getElementById('action-button').innerText = '暂停';
    }
}

function handleAction() {
    const actionButton = document.getElementById('action-button');
    switch (actionButton.innerText) {
        case '暂停':
            pauseStream();
            break;
        case '继续':
            resumeStream();
            break;
        case '发送':
            stopStream();
            askGPT();
            break;
    }
}
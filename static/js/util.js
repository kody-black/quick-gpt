let conversationHistory = [];
let selectedModel = '';
let currentAssistantResponse = '';
let assistantDiv;
let reader;
let isStreaming = false;

function populateSelects() {
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

async function askGPT() {
    const question = document.getElementById('question').value;
    if (!question.trim()) {
        return;
    }
    conversationHistory.push({
        role: 'user',
        content: question
    });

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

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const body = response.body;
        const reader = body.getReader();
        isStreaming = true;
        document.getElementById('action-button').innerText = '停止';

        return new ReadableStream({
            start(controller) {
                function push() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            controller.close();
                            isStreaming = false;
                            document.getElementById('action-button').innerText = '确定';
                            return;
                        }
                        const textDecoder = new TextDecoder();
                        const chunk = textDecoder.decode(value);
                        handleStreamedResponse(chunk);
                        push();
                    }).catch(err => {
                        isStreaming = false;
                        document.getElementById('action-button').innerText = '确定';
                        const outputDiv = document.getElementById('output');
                        outputDiv.innerHTML = '对话请求失败！<br>' + err.message;
                    });
                }
                push();
            }
        });
    } catch (err) {
        isStreaming = false;
        document.getElementById('action-button').innerText = '确定';
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = '对话请求失败！<br>' + err.message;
        outputDiv.scrollTop = outputDiv.scrollHeight;
    }
}

function handleStreamedResponse(chunk) {
    const lines = chunk.split('\n').filter(line => line.trim() !== '');
    const model_name = document.getElementById('model-select').value;
    lines.forEach(line => {
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
            conversationHistory.push({
                role: 'assistant',
                content: currentAssistantResponse
            });
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
    // 清空对话历史
    conversationHistory = [];
    currentAssistantResponse = '';
    assistantDiv = null;
    document.getElementById('output').innerHTML = '';
    loadModels();
}


function reset() {
    window.loadConfig();
    populateSelects();
    refreshModels();
}

function stopStream() {
    if (reader) {
        reader.cancel();
        isStreaming = false;
        document.getElementById('action-button').innerText = '确定';
        conversationHistory.push({
            role: 'assistant',
            content: currentAssistantResponse
        });
        displayConversationHistory();
        currentAssistantResponse = '';
        assistantDiv = null;
    }
}

function handleAction() {
    if (isStreaming) {
        stopStream();
    } else {
        askGPT();
    }
}


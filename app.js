// app.js - 多模型图像/视频生成工具 (完整版，支持 FLUX 模型)
const API_BASE = '/api';
const DL_ENDPOINT = '/dl';

// ========== DOM 引用 ==========
const modelSelect = document.getElementById('modelSel');

// z-image 元素
const zPrompt = document.getElementById('zPrompt');
const zRes = document.getElementById('zRes');
const zN = document.getElementById('zN');
const btnZRun = document.getElementById('btnZRun');

// FLUX.1-dev 元素
const fluxDevPrompt = document.getElementById('fluxDevPrompt');
const fluxDevRes = document.getElementById('fluxDevRes');
const fluxDevN = document.getElementById('fluxDevN');
const btnFluxDevRun = document.getElementById('btnFluxDevRun');

// FLUX.1-schnell 元素
const fluxSchnellPrompt = document.getElementById('fluxSchnellPrompt');
const fluxSchnellRes = document.getElementById('fluxSchnellRes');
const fluxSchnellN = document.getElementById('fluxSchnellN');
const btnFluxSchnellRun = document.getElementById('btnFluxSchnellRun');

// FLUX.2-dev 元素
const flux2DevPrompt = document.getElementById('flux2DevPrompt');
const flux2DevRes = document.getElementById('flux2DevRes');
const flux2DevN = document.getElementById('flux2DevN');
const btnFlux2DevRun = document.getElementById('btnFlux2DevRun');

// Edit-2511 元素
const editImg1 = document.getElementById('editImg1');
const editImg2 = document.getElementById('editImg2');
const editPrompt = document.getElementById('editPrompt');
const editTaskTypes = document.getElementById('editTaskTypes');
const editSteps = document.getElementById('editSteps');
const editGuidance = document.getElementById('editGuidance');
const editOpenUrl = document.getElementById('editOpenUrl');
const btnEditRun = document.getElementById('btnEditRun');

// Wan2.2 元素
const wanImg = document.getElementById('wanImg');
const wanPrompt = document.getElementById('wanPrompt');
const wanNeg = document.getElementById('wanNeg');
const wanPreset = document.getElementById('wanPreset');
const btnWanApplyPreset = document.getElementById('btnWanApplyPreset');
const wanResPreset = document.getElementById('wanResPreset');
const wanW = document.getElementById('wanW');
const wanH = document.getElementById('wanH');
const wanSteps = document.getElementById('wanSteps');
const wanGuidance = document.getElementById('wanGuidance');
const wanSeed = document.getElementById('wanSeed');
const wanWatermark = document.getElementById('wanWatermark');
const wanPromptExtend = document.getElementById('wanPromptExtend');
const wanOpenUrl = document.getElementById('wanOpenUrl');
const wanFps = document.getElementById('wanFps');
const wanDuration = document.getElementById('wanDuration');
const wanFrames = document.getElementById('wanFrames');
const wanAutoFrames = document.getElementById('wanAutoFrames');
const wanZipSegments = document.getElementById('wanZipSegments');
const btnWanRun = document.getElementById('btnWanRun');

// HunyuanVideo 元素
const hyPrompt = document.getElementById('hyPrompt');
const hyNeg = document.getElementById('hyNeg');
const hyAspect = document.getElementById('hyAspect');
const hySteps = document.getElementById('hySteps');
const hyFps = document.getElementById('hyFps');
const hyFrames = document.getElementById('hyFrames');
const hySeed = document.getElementById('hySeed');
const hyOpenUrl = document.getElementById('hyOpenUrl');
const btnHyRun = document.getElementById('btnHyRun');

// 输出元素
const outputArea = document.getElementById('output');
const statusMsg = document.getElementById('statusBadge');

// ========== 模型配置 ==========
const MODEL_CONFIGS = {
    'z-image': { defaultSteps: 9, guidanceScale: 0.0 },
    'FLUX.1-dev': { defaultSteps: 50, guidanceScale: 7.0 },
    'FLUX.1-schnell': { defaultSteps: 4, guidanceScale: 0.0 },
    'FLUX.2-dev': { defaultSteps: 28, guidanceScale: 7.0 },
    'Edit-2511': { defaultSteps: 30, guidanceScale: 7.5 },
    'Wan2.2-I2V-A14B': { defaultSteps: 20, guidanceScale: 7.0 },
    'HunyuanVideo-1.5': { defaultSteps: 10, guidanceScale: 7.0 }
};

// ========== 初始化 ==========
// 填充分辨率选项
function populateResolutions(selectElement) {
    if (!selectElement) return;
    const resolutions = [
        '512x512', '768x768', '1024x1024', '1152x1152',
        '1280x1280', '1536x1536', '1792x1792', '2048x2048'
    ];
    selectElement.innerHTML = '';
    resolutions.forEach(res => {
        const option = document.createElement('option');
        option.value = res;
        option.textContent = res;
        selectElement.appendChild(option);
    });
    selectElement.value = '1024x1024';
}

// 填充所有分辨率下拉框
populateResolutions(zRes);
populateResolutions(fluxDevRes);
populateResolutions(fluxSchnellRes);
populateResolutions(flux2DevRes);
populateResolutions(wanResPreset);

// 填充 Edit 任务类型
function populateEditTaskTypes() {
    if (!editTaskTypes) return;
    const types = ['background_remove', 'object_replace', 'style_transfer', 'color_change', 'inpainting'];
    editTaskTypes.innerHTML = '';
    types.forEach(type => {
        const label = document.createElement('label');
        label.className = 'chk';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = type;
        checkbox.name = 'editTaskType';
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(type));
        editTaskTypes.appendChild(label);
    });
}
populateEditTaskTypes();

// 填充 Wan 分辨率预设
function populateWanPresets() {
    if (!wanResPreset) return;
    const presets = [
        '832x480', '1024x576', '1152x640', '1280x720',
        '1920x1080', '720x1280', '576x1024', '480x832'
    ];
    wanResPreset.innerHTML = '';
    presets.forEach(res => {
        const option = document.createElement('option');
        option.value = res;
        option.textContent = res;
        wanResPreset.appendChild(option);
    });
    wanResPreset.value = '832x480';
}
populateWanPresets();

// Wan 预设应用
if (btnWanApplyPreset) {
    btnWanApplyPreset.addEventListener('click', function() {
        const preset = wanPreset.value;
        // 根据不同预设调整参数
        const presets = {
            '标准 / Standard': { steps: 30, guidance: 5, seed: -1 },
            '更清晰 / Sharper': { steps: 50, guidance: 7, seed: -1 },
            '更动感 / More motion': { steps: 40, guidance: 6, seed: -1 },
            '更快 / Faster': { steps: 20, guidance: 4, seed: -1 }
        };
        const config = presets[preset] || presets['标准 / Standard'];
        if (wanSteps) wanSteps.value = config.steps;
        if (wanGuidance) wanGuidance.value = config.guidance;
        if (wanSeed) wanSeed.value = config.seed;
    });
}

// Wan 分辨率预设应用
if (wanResPreset) {
    wanResPreset.addEventListener('change', function() {
        const [w, h] = this.value.split('x').map(Number);
        if (wanW) wanW.value = w;
        if (wanH) wanH.value = h;
    });
}

// Wan 自动帧数计算
if (wanAutoFrames) {
    wanAutoFrames.addEventListener('change', function() {
        if (this.checked && wanFps && wanFrames && wanDuration) {
            const fps = parseInt(wanFps.value) || 24;
            const duration = parseFloat(wanDuration.value) || 5;
            wanFrames.value = Math.round(fps * duration);
        }
    });
}

// ========== 生成函数 ==========
async function generateWithModel(modelKey, prompt, width, height, n = 1, steps = 20, guidance = 7.0) {
    const apiKey = document.getElementById('apiKey')?.value?.trim();
    if (!apiKey) {
        alert('请先输入 API Key');
        return;
    }

    if (!prompt) {
        alert('请输入提示词');
        return;
    }

    // 显示状态
    setStatus('正在生成...', '#f59e0b');

    try {
        const payload = {
            model: modelKey,
            prompt: prompt,
            width: width,
            height: height,
            num_inference_steps: steps,
            guidance_scale: guidance,
        };

        if (modelKey.startsWith('FLUX.')) {
            payload.output_format = 'png';
        }

        // 提交任务
        const submitRes = await fetch(`${API_BASE}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text();
            let errMsg = `提交失败 (${submitRes.status})`;
            try {
                const errJson = JSON.parse(errText);
                errMsg = errJson.message || errJson.error || errText;
            } catch {
                errMsg = errText || errMsg;
            }
            throw new Error(errMsg);
        }

        const taskData = await submitRes.json();
        const taskId = taskData.task_id;
        if (!taskId) {
            if (taskData.output_images) {
                handleResult(taskData);
                return;
            }
            throw new Error('未获取到任务 ID');
        }

        setStatus(`处理中...`, '#f59e0b');

        // 轮询结果
        let result = null;
        for (let i = 0; i < 90; i++)

// 前端JavaScript逻辑，处理表单提交和文件下载

class PPTGeneratorApp {
    constructor() {
        this.initializeEventListeners();
        this.checkAPIHealth();
    }

    initializeEventListeners() {
        // 生成大纲按钮
        document.getElementById('generateOutlineBtn').addEventListener('click', () => {
            this.generateOutline();
        });

        // 生成完整PPT按钮
        document.getElementById('generatePPTBtn').addEventListener('click', () => {
            this.generateCompletePPT();
        });

        // 表单提交阻止默认行为
        document.getElementById('pptForm').addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    async checkAPIHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            if (data.status === 'healthy') {
                this.showStatus('API服务正常运行', 'success');
            } else {
                this.showStatus('API服务异常', 'error');
            }
        } catch (error) {
            this.showStatus('无法连接到API服务', 'error');
        }
    }

    async generateOutline() {
        const prompt = document.getElementById('prompt').value.trim();
        
        if (!prompt) {
            this.showStatus('请输入PPT主题或需求描述', 'error');
            return;
        }

        this.showLoading('正在生成大纲...');
        this.hideResults();

        try {
            const response = await fetch('/api/generate-outline', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt })
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.displayOutlineResult(result);
                this.showStatus('大纲生成成功！', 'success');
            } else {
                this.showStatus(`大纲生成失败: ${result.error || '未知错误'}`, 'error');
            }
        } catch (error) {
            this.showStatus(`网络错误: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async generateCompletePPT() {
        const prompt = document.getElementById('prompt').value.trim();
        const outputTitle = document.getElementById('outputTitle').value.trim();
        
        if (!prompt) {
            this.showStatus('请输入PPT主题或需求描述', 'error');
            return;
        }

        this.showLoading('正在生成完整PPT，这可能需要一些时间...');
        this.hideResults();

        try {
            const requestData = { prompt: prompt };
            if (outputTitle) {
                requestData.output_title = outputTitle;
            }

            const response = await fetch('/api/generate-ppt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.displayPPTResult(result);
                this.showStatus('PPT生成成功！', 'success');
            } else {
                this.showStatus(`PPT生成失败: ${result.error || '未知错误'}`, 'error');
            }
        } catch (error) {
            this.showStatus(`网络错误: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayOutlineResult(result) {
        const resultSection = document.getElementById('resultSection');
        const outlinePreview = document.getElementById('outlinePreview');
        const outlineContent = document.getElementById('outlineContent');
        const resultTitle = document.getElementById('resultTitle');

        resultTitle.textContent = `大纲预览 - ${result.main_topic}`;
        
        // 构建大纲内容
        let outlineHTML = `
            <div class="mb-3">
                <strong>主主题:</strong> ${result.main_topic}
            </div>
            <div class="mb-3">
                <strong>总结主题:</strong> ${result.summary_topic}
            </div>
            <div class="mb-3">
                <strong>幻灯片数量:</strong> ${result.outline.length + 2} 张（${result.outline.length}张双栏页 + 封面 + 总结）
            </div>
            <h6 class="fw-semibold mt-4 mb-3">详细结构:</h6>
        `;

        result.outline.forEach((item, index) => {
            outlineHTML += `
                <div class="outline-item">
                    <div class="fw-semibold">第${index + 1}张：${item.sub_topic}</div>
                    <div class="row mt-2">
                        <div class="col-md-6">
                            <small class="text-muted">左栏：</small>
                            <div>${item.topic1}</div>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted">右栏：</small>
                            <div>${item.topic2}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        outlineContent.innerHTML = outlineHTML;
        outlinePreview.style.display = 'block';
        resultSection.style.display = 'block';
    }

    displayPPTResult(result) {
        const resultSection = document.getElementById('resultSection');
        const downloadSection = document.getElementById('downloadSection');
        const successMessage = document.getElementById('successMessage');
        const downloadLink = document.getElementById('downloadLink');
        const resultTitle = document.getElementById('resultTitle');

        resultTitle.textContent = `PPT生成完成 - ${result.main_topic}`;
        
        successMessage.textContent = `成功生成PPT文件，包含 ${result.slides_count} 张幻灯片。`;
        downloadLink.href = result.download_url;
        downloadLink.download = result.file_path ? result.file_path.split('/').pop() : 'presentation.pptx';

        downloadSection.style.display = 'block';
        resultSection.style.display = 'block';
    }

    showLoading(message = '正在处理...') {
        const loadingSpinner = document.getElementById('loadingSpinner');
        const loadingText = document.getElementById('loadingText');
        
        loadingText.textContent = message;
        loadingSpinner.style.display = 'block';
        
        // 禁用按钮
        document.getElementById('generateOutlineBtn').disabled = true;
        document.getElementById('generatePPTBtn').disabled = true;
    }

    hideLoading() {
        const loadingSpinner = document.getElementById('loadingSpinner');
        loadingSpinner.style.display = 'none';
        
        // 启用按钮
        document.getElementById('generateOutlineBtn').disabled = false;
        document.getElementById('generatePPTBtn').disabled = false;
    }

    showStatus(message, type = 'info') {
        const statusIndicator = document.getElementById('statusIndicator');
        
        statusIndicator.textContent = message;
        statusIndicator.className = `status-indicator status-${type}`;
        statusIndicator.style.display = 'block';

        // 5秒后自动隐藏
        setTimeout(() => {
            statusIndicator.style.display = 'none';
        }, 5000);
    }

    hideResults() {
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('outlinePreview').style.display = 'none';
        document.getElementById('downloadSection').style.display = 'none';
    }

    // 工具函数：格式化错误消息
    formatErrorMessage(error) {
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        return '未知错误';
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    new PPTGeneratorApp();
});

// 添加一些辅助函数
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // 可以添加复制成功的提示
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

// 添加键盘快捷键支持
document.addEventListener('keydown', function(e) {
    // Ctrl+Enter 生成完整PPT
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('generatePPTBtn').click();
    }
    
    // Ctrl+Shift+Enter 生成大纲
    if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('generateOutlineBtn').click();
    }
});
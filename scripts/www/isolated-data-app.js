class IsolatedDataApp {
    constructor() {
        this.db = new IsolatedDataDatabase();
        this.currentDate = new Date();
        this.currentDimension = 'day';
        this.pendingDeleteTaskId = null;
        this.init();
    }

    async init() {
        try {
            await this.db.init();
            this.setupEventListeners();
            await this.loadInitialData();
            // 设置默认视图显示
            await this.switchDimension(this.currentDimension);
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    setupEventListeners() {
        // 时间维度切换
        document.querySelectorAll('.dimension-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchDimension(e.target.dataset.dimension);
            });
        });

        // 任务管理
        document.getElementById('addTaskBtn').addEventListener('click', () => this.addTask());
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // 日历导航（仅日视图使用）
        document.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));

        // 筛选功能已移除

        // 模态框
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // 删除确认
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDeleteTask();
        });
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            document.getElementById('deleteConfirmModal').style.display = 'none';
        });

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    async loadInitialData() {
        await this.populateTaskFilters();
    }

    async populateTaskFilters() {
        // 筛选功能已移除，此函数为空实现
        // 保留函数以避免调用错误
    }

    renderCalendar() {
        // 在月视图显示月份表格
        if (this.currentDimension === 'month') {
            this.renderMonthGrid();
        }
        
        // 仅在日视图显示日历
        // 仅在日视图显示日历
        if (this.currentDimension === 'day') {
            const calendarGrid = document.getElementById('calendarGrid');
            const currentMonth = this.currentDate.getMonth();
            const currentYear = this.currentDate.getFullYear();
            
            // 更新月份标题
            document.getElementById('currentMonth').textContent = 
                `${currentYear}年${currentMonth + 1}月`;

            // 获取当月第一天和最后一天
            const firstDay = new Date(currentYear, currentMonth, 1);
            const lastDay = new Date(currentYear, currentMonth + 1, 0);
            
            // 清空日历
            calendarGrid.innerHTML = '';
            
            // 添加星期标题
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            weekdays.forEach(day => {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day weekday-header';
                dayElement.textContent = day;
                dayElement.style.fontWeight = 'bold';
                calendarGrid.appendChild(dayElement);
            });
            
            // 计算开始位置
            const startDay = firstDay.getDay();
            
            // 添加上个月的日期
            const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
            for (let i = startDay - 1; i >= 0; i--) {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day other-month';
                dayElement.textContent = prevMonthLastDay - i;
                calendarGrid.appendChild(dayElement);
            }
            
            // 添加当月日期
            const today = new Date();
            for (let day = 1; day <= lastDay.getDate(); day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day';
                dayElement.textContent = day;
                
                // 检查是否是今天
                if (currentYear === today.getFullYear() && 
                    currentMonth === today.getMonth() && 
                    day === today.getDate()) {
                    dayElement.classList.add('current');
                }
                
                // 检查是否是系统当前日期（加粗显示）
                if (currentYear === today.getFullYear() && 
                    currentMonth === today.getMonth() && 
                    day === today.getDate()) {
                    dayElement.classList.add('today-bold');
                }
                
                // 检查是否有任务（仅日视图任务）
                this.checkAndMarkDayViewTasks(dayElement, day, currentYear, currentMonth);
                
                // 添加点击事件
                dayElement.addEventListener('click', () => {
                    this.selectDate(new Date(currentYear, currentMonth, day));
                });
                
                calendarGrid.appendChild(dayElement);
            }
            
            // 添加下个月的日期
            const totalCells = 42; // 6行×7列
            const remainingCells = totalCells - calendarGrid.children.length;
            for (let day = 1; day <= remainingCells; day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day other-month';
                dayElement.textContent = day;
                calendarGrid.appendChild(dayElement);
            }
        }
    }

    async checkAndMarkDayViewTasks(dayElement, day, year, month) {
        // 注意：month参数已经是正确的月份（0-11），不需要+1
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const tasks = await this.db.getTasksByDateKey(dateKey, 'day'); // 仅检查日视图任务
        
        if (tasks.length > 0) {
            dayElement.classList.add('has-tasks');
        }
    }

    async renderTasks() {
        const taskList = document.getElementById('taskList');
        const currentDateTitle = document.getElementById('currentDateTitle');
        
        let tasks = [];
        
        switch (this.currentDimension) {
            case 'day':
                // 日视图：仅显示日视图类型的任务
                tasks = await this.db.getTasksByDate(this.currentDate, 'day');
                currentDateTitle.textContent = this.formatDate(this.currentDate) + ' 任务';
                taskList.parentElement.parentElement.className = 'task-list-section';
                break;
            case 'month':
                // 月视图：仅显示月视图类型的任务
                tasks = await this.db.getTasksByMonth(
                    this.currentDate.getFullYear(), 
                    this.currentDate.getMonth(),
                    'month'
                );
                currentDateTitle.textContent = `${this.currentDate.getFullYear()}年${this.currentDate.getMonth() + 1}月 任务`;
                taskList.parentElement.parentElement.className = 'task-list-section month-view';
                break;
            case 'year':
                // 年视图：仅显示年视图类型的任务
                tasks = await this.db.getTasksByYear(this.currentDate.getFullYear(), 'year');
                currentDateTitle.textContent = `${this.currentDate.getFullYear()}年 任务`;
                taskList.parentElement.parentElement.className = 'task-list-section year-view';
                break;
        }
        
        // 排序：未完成任务优先，已完成任务按完成时间从早到晚排序
        tasks.sort((a, b) => {
            // 未完成的任务排在前面
            if (!a.completed && b.completed) return -1;
            if (a.completed && !b.completed) return 1;
            
            // 如果都是已完成，按完成时间从早到晚排序
            if (a.completed && b.completed) {
                return new Date(a.completedAt) - new Date(b.completedAt);
            }
            
            // 如果都是未完成，按创建时间排序
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
        
        this.renderTaskList(tasks);
        this.updateTaskCounts(tasks);
    }

    renderTaskList(tasks) {
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';

        if (this.currentDimension === 'day') {
            // 日视图：显示单个任务列表
            tasks.forEach(task => {
                taskList.appendChild(this.createTaskElement(task));
            });
        } else {
            // 月视图和年视图：按日期分组显示
            const groupedTasks = this.groupTasksByDate(tasks);
            
            Object.keys(groupedTasks).sort().reverse().forEach(dateKey => {
                const dayGroup = document.createElement('div');
                dayGroup.className = 'day-task-group';
                
                const dayHeader = document.createElement('div');
                dayHeader.className = 'day-header';
                dayHeader.textContent = this.formatDateKey(dateKey);
                dayGroup.appendChild(dayHeader);
                
                groupedTasks[dateKey].forEach(task => {
                    dayGroup.appendChild(this.createTaskElement(task));
                });
                
                taskList.appendChild(dayGroup);
            });
        }

        if (tasks.length === 0) {
            taskList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无任务</div>';
        }
    }

    groupTasksByDate(tasks) {
        return tasks.reduce((groups, task) => {
            const dateKey = task.dateKey;
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(task);
            return groups;
        }, {});
    }

    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => this.toggleTask(task.id));

        const contentDiv = document.createElement('div');
        contentDiv.className = 'task-content';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'task-text';
        textSpan.textContent = task.text;
        
        const metaSpan = document.createElement('span');
        metaSpan.className = 'task-meta';
        
        const createdTime = document.createElement('div');
        createdTime.textContent = `创建: ${this.db.formatDateTime(task.createdAt)}`;
        
        const completedTime = document.createElement('div');
        completedTime.className = 'task-completion-time';
        completedTime.textContent = task.completed ? 
            `完成: ${this.db.formatDateTime(task.completedAt)}` : 
            '状态: 未完成';
        
        metaSpan.appendChild(createdTime);
        metaSpan.appendChild(completedTime);
        
        contentDiv.appendChild(textSpan);
        contentDiv.appendChild(metaSpan);
        
        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDeleteConfirm(task);
        });
        
        taskDiv.appendChild(checkbox);
        taskDiv.appendChild(contentDiv);
        taskDiv.appendChild(deleteBtn);
        
        // 双击查看详情
        taskDiv.addEventListener('dblclick', () => this.showTaskDetail(task));
        
        return taskDiv;
    }

    getViewTypeLabel(viewType) {
        const labels = {
            'day': '日视图',
            'month': '月视图',
            'year': '年视图'
        };
        return labels[viewType] || '未知';
    }

    getViewTypeColor(viewType) {
        const colors = {
            'day': '#667eea',
            'month': '#2ecc71',
            'year': '#e74c3c'
        };
        return colors[viewType] || '#95a5a6';
    }

    async toggleTask(taskId) {
        try {
            const task = (await this.db.getAllTasks()).find(t => t.id === taskId);
            if (task) {
                await this.db.updateTask(taskId, { 
                    completed: !task.completed,
                    completedAt: !task.completed ? new Date().toISOString() : null
                });
                await this.renderTasks();
                this.updateStats();
                if (this.currentDimension === 'day') {
                    this.renderCalendar();
                }
            }
        } catch (error) {
            console.error('更新任务失败:', error);
        }
    }

    async addTask() {
        const taskInput = document.getElementById('taskInput');
        const text = taskInput.value.trim();
        
        if (!text) {
            alert('请输入任务内容');
            return;
        }

        try {
            // 根据当前视图类型添加任务
            await this.db.addTask(text, this.currentDate, this.currentDimension);
            taskInput.value = '';
            await this.renderTasks();
            this.updateStats();
            if (this.currentDimension === 'day') {
                this.renderCalendar();
            }
            await this.populateTaskFilters();
        } catch (error) {
            console.error('添加任务失败:', error);
            alert('添加任务失败，请重试');
        }
    }

    showDeleteConfirm(task) {
        this.pendingDeleteTaskId = task.id;
        const modal = document.getElementById('deleteConfirmModal');
        const message = document.getElementById('deleteConfirmMessage');
        
        message.textContent = `确定要删除${this.getViewTypeLabel(task.viewType)}任务"${task.text}"吗？此操作不可撤销。`;
        modal.style.display = 'block';
    }

    async confirmDeleteTask() {
        if (this.pendingDeleteTaskId) {
            try {
                await this.db.deleteTask(this.pendingDeleteTaskId);
                document.getElementById('deleteConfirmModal').style.display = 'none';
                await this.renderTasks();
                this.updateStats();
                if (this.currentDimension === 'day') {
                    this.renderCalendar();
                }
                await this.populateTaskFilters();
                this.pendingDeleteTaskId = null;
            } catch (error) {
                console.error('删除任务失败:', error);
                alert('删除任务失败，请重试');
            }
        }
    }

    async switchDimension(dimension) {
        // 更新当前维度
        this.currentDimension = dimension;
        
        // 更新按钮状态
        document.querySelectorAll('.dimension-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.dimension === dimension);
        });
        
        // 更新界面类名
        document.body.className = dimension + '-view';
        
        // 重新渲染日历（仅日视图）和任务
        this.renderCalendar();
        await this.renderTasks();
        this.updateStats();
    }

    async navigateMonth(direction) {
        // 仅在日视图允许月份导航
        if (this.currentDimension === 'day') {
            this.currentDate.setMonth(this.currentDate.getMonth() + direction);
            this.renderCalendar();
            await this.renderTasks();
            this.updateStats();
        }
    }

    // 渲染月份表格
    async renderMonthGrid() {
        const monthGrid = document.getElementById('monthGrid');
        if (!monthGrid) return;

        const currentYear = this.currentDate.getFullYear();
        const currentMonth = this.currentDate.getMonth();
        
        // 清空现有内容
        monthGrid.innerHTML = '';

        // 创建1-12月的表格
        for (let month = 0; month < 12; month++) {
            const monthCell = document.createElement('div');
            monthCell.className = 'month-cell';
            monthCell.textContent = (month + 1) + '月';
            monthCell.dataset.month = month;
            
            // 标记当前月份
            if (month === currentMonth) {
                monthCell.classList.add('current');
            }

            // 检查该月份是否有任务
            const hasTasks = await this.checkMonthHasTasks(currentYear, month);
            if (hasTasks) {
                monthCell.classList.add('has-tasks');
            }

            // 添加点击事件
            monthCell.addEventListener('click', () => {
                this.selectMonth(month);
            });

            monthGrid.appendChild(monthCell);
        }
    }

    // 检查月份是否有任务
    async checkMonthHasTasks(year, month) {
        try {
            const tasks = await this.db.getTasksByMonth(year, month, 'month');
            return tasks.length > 0;
        } catch (error) {
            console.error('检查月份任务失败:', error);
            return false;
        }
    }

    // 选择月份
    async selectMonth(month) {
        // 更新当前日期到选中的月份
        this.currentDate.setMonth(month);
        
        // 重新渲染月份表格和任务列表
        await this.renderMonthGrid();
        await this.renderTasks();
        this.updateStats();
    }

    selectDate(date) {
        // 仅在日视图允许日期选择
        if (this.currentDimension === 'day') {
            this.currentDate = date;
            this.renderTasks();
            this.updateStats();
        }
    }

    async updateStats() {
        const currentYear = this.currentDate.getFullYear();
        const currentMonth = this.currentDate.getMonth();
        
        switch (this.currentDimension) {
            case 'day':
                // 日视图：只显示日视图的统计和筛选
                const dailyStats = await this.db.getDailyStats(this.currentDate, 'day');
                this.renderDailyProgress(dailyStats);
                break;
                
            case 'month':
                // 月视图：显示本月完成进度
                const monthlyStats = await this.db.getMonthlyStats(currentYear, currentMonth, 'month');
                this.renderMonthlyProgress(monthlyStats);
                break;
                
            case 'year':
                // 年视图：年度排名基于日视图任务统计（不需要数据隔离）
                const yearlyRankings = await this.db.getYearlyRankings(currentYear, 'day'); // 基于日视图任务统计
                this.renderYearlyRankings(yearlyRankings);
                break;
        }
    }

    renderDailyProgress(stats) {
        const progressFill = document.getElementById('dailyProgress');
        const progressText = document.getElementById('dailyProgressText');
        
        progressFill.style.width = `${stats.progress}%`;
        progressText.textContent = `${stats.completed}/${stats.total}`;
    }

    renderMonthlyProgress(stats) {
        const progressFill = document.getElementById('monthlyProgress');
        const progressText = document.getElementById('monthlyProgressText');
        
        // 检查stats是否为有效数据
        if (!stats || !Array.isArray(stats)) {
            progressFill.style.width = '0%';
            progressText.textContent = '0/0';
            return;
        }
        
        // 计算本月总任务数和完成数
        let totalTasks = 0;
        let completedTasks = 0;
        
        stats.forEach(stat => {
            // 数据库返回的数据结构：{text, total, completed, progress}
            totalTasks += stat.total || 0;
            completedTasks += stat.completed || 0;
        });
        
        // 计算进度百分比
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${completedTasks}/${totalTasks}`;
    }

    renderMonthlyStats(stats, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (stats.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; font-size: 12px;">本月暂无任务</div>';
            return;
        }
        
        stats.forEach(stat => {
            const statItem = document.createElement('div');
            statItem.className = 'task-stat-item';
            
            const header = document.createElement('div');
            header.className = 'task-stat-header';
            
            const name = document.createElement('div');
            name.className = 'task-stat-name';
            name.textContent = stat.text.length > 20 ? stat.text.substring(0, 20) + '...' : stat.text;
            
            const count = document.createElement('div');
            count.className = 'task-stat-count';
            count.textContent = `${stat.completed}/${stat.total}`;
            
            header.appendChild(name);
            header.appendChild(count);
            
            const progress = document.createElement('div');
            progress.className = 'task-stat-progress';
            
            const fill = document.createElement('div');
            fill.className = 'task-stat-fill';
            fill.style.width = `${stat.progress}%`;
            
            progress.appendChild(fill);
            
            statItem.appendChild(header);
            statItem.appendChild(progress);
            
            container.appendChild(statItem);
        });
    }

    renderYearlyRankings(rankings) {
        const container = document.getElementById('yearlyTaskStats');
        container.innerHTML = '';
        
        if (rankings.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; font-size: 12px;">本年暂无完成任务</div>';
            return;
        }
        
        rankings.forEach((ranking, index) => {
            const rankingItem = document.createElement('div');
            rankingItem.className = 'ranking-item';
            
            const rank = document.createElement('div');
            rank.className = `ranking-rank top-${index + 1}`;
            rank.textContent = index + 1;
            
            const content = document.createElement('div');
            content.className = 'ranking-content';
            
            const text = document.createElement('div');
            text.className = 'ranking-text';
            text.textContent = ranking.text.length > 15 ? ranking.text.substring(0, 15) + '...' : ranking.text;
            text.title = ranking.text;
            
            const count = document.createElement('div');
            count.className = 'ranking-count';
            count.textContent = `完成 ${ranking.count} 次`;
            
            content.appendChild(text);
            content.appendChild(count);
            
            rankingItem.appendChild(rank);
            rankingItem.appendChild(content);
            
            container.appendChild(rankingItem);
        });
    }

    async applyFilters(dimension) {
        let tasks = [];
        
        switch (dimension) {
            case 'day':
                tasks = await this.db.getTasksByDate(this.currentDate, 'day');
                break;
            case 'month':
                tasks = await this.db.getTasksByMonth(
                    this.currentDate.getFullYear(), 
                    this.currentDate.getMonth(),
                    'month'
                );
                break;
            case 'year':
                // 年视图：任务列表和筛选基于年视图任务，但年度排名基于日视图任务
                tasks = await this.db.getTasksByYear(this.currentDate.getFullYear(), 'year');
                break;
        }
        
        // 获取筛选条件
        const completionFilter = document.getElementById('completionFilter' + (dimension === 'day' ? '' : dimension.charAt(0).toUpperCase() + dimension.slice(1))).value;
        
        // 应用完成状态筛选
        if (completionFilter !== 'all') {
            tasks = tasks.filter(task => {
                if (completionFilter === 'completed') return task.completed;
                if (completionFilter === 'pending') return !task.completed;
                return true;
            });
        }

        // 排序：未完成任务优先，已完成任务按完成时间从早到晚排序
        tasks.sort((a, b) => {
            // 未完成的任务排在前面
            if (!a.completed && b.completed) return -1;
            if (a.completed && !b.completed) return 1;
            
            // 如果都是已完成，按完成时间从早到晚排序
            if (a.completed && b.completed) {
                return new Date(a.completedAt) - new Date(b.completedAt);
            }
            
            // 如果都是未完成，按创建时间排序
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
        
        this.renderTaskList(tasks);
        this.updateTaskCounts(tasks);
    }

    updateTaskCounts(tasks) {
        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        
        document.getElementById('completedCount').textContent = completed;
        document.getElementById('totalCount').textContent = total;
    }

    showTaskDetail(task) {
        const modal = document.getElementById('taskDetailModal');
        const content = document.getElementById('taskDetailContent');
        
        content.innerHTML = `
            <div><strong>任务内容:</strong> ${task.text}</div>
            <div><strong>视图类型:</strong> ${this.getViewTypeLabel(task.viewType)}</div>
            <div><strong>创建时间:</strong> ${this.db.formatDetailedTime(task.createdAt)}</div>
            <div><strong>目标日期:</strong> ${this.db.formatDateTime(task.targetDate)}</div>
            <div><strong>完成状态:</strong> ${task.completed ? '已完成' : '未完成'}</div>
            ${task.completed ? `<div><strong>完成时间:</strong> ${this.db.formatDetailedTime(task.completedAt)}</div>` : ''}
            <div><strong>任务ID:</strong> ${task.id}</div>
        `;
        
        modal.style.display = 'block';
    }

    // 工具函数
    formatDate(date) {
        const d = new Date(date);
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }

    formatDateKey(dateKey) {
        const [year, month, day] = dateKey.split('-');
        const date = new Date(year, month - 1, day);
        return this.formatDate(date);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new IsolatedDataApp();
});
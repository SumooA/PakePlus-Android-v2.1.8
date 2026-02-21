class IsolatedDataDatabase {
    constructor() {
        this.dbName = 'IsolatedDataDB';
        this.version = 2; // 版本升级以支持新字段
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                // 创建或升级任务存储
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                    taskStore.createIndex('dateKey', 'dateKey', { unique: false });
                    taskStore.createIndex('completed', 'completed', { unique: false });
                    taskStore.createIndex('text', 'text', { unique: false });
                    taskStore.createIndex('createdAt', 'createdAt', { unique: false });
                    taskStore.createIndex('viewType', 'viewType', { unique: false });
                } else if (oldVersion < 2) {
                    // 版本升级：添加viewType字段
                    const transaction = event.target.transaction;
                    const taskStore = transaction.objectStore('tasks');
                    
                    // 为现有任务添加默认viewType
                    const getAllRequest = taskStore.getAll();
                    getAllRequest.onsuccess = () => {
                        const tasks = getAllRequest.result;
                        tasks.forEach(task => {
                            if (!task.viewType) {
                                task.viewType = 'day'; // 默认标记为日视图任务
                                taskStore.put(task);
                            }
                        });
                    };
                    
                    // 创建新的索引
                    taskStore.createIndex('viewType', 'viewType', { unique: false });
                }
            };
        });
    }

    // 生成时间维度键（以天为单位）
    generateDateKey(date) {
        const d = new Date(date);
        // 使用本地时间生成日期键，避免时区问题
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`; // YYYY-MM-DD
    }

    // 添加任务（带视图类型标记）
    async addTask(text, targetDate, viewType = 'day') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            
            const task = {
                text: text,
                targetDate: targetDate.toISOString(),
                dateKey: this.generateDateKey(targetDate),
                viewType: viewType, // 添加视图类型标记
                completed: false,
                createdAt: new Date().toISOString(),
                completedAt: null
            };

            const request = store.add(task);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 获取所有任务
    async getAllTasks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 根据日期和视图类型获取任务
    async getTasksByDate(date, viewType = null) {
        const dateKey = this.generateDateKey(date);
        return this.getTasksByDateKey(dateKey, viewType);
    }

    // 根据日期键和视图类型获取任务
    async getTasksByDateKey(dateKey, viewType = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const index = store.index('dateKey');
            const request = index.getAll(dateKey);

            request.onsuccess = () => {
                let tasks = request.result;
                if (viewType) {
                    tasks = tasks.filter(task => task.viewType === viewType);
                }
                resolve(tasks);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 根据月份和视图类型获取任务
    async getTasksByMonth(year, month, viewType = null) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();

            request.onsuccess = () => {
                let tasks = request.result.filter(task => {
                    const taskDate = new Date(task.targetDate);
                    return taskDate >= startDate && taskDate <= endDate;
                });
                
                if (viewType) {
                    tasks = tasks.filter(task => task.viewType === viewType);
                }
                resolve(tasks);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 根据年份和视图类型获取任务
    async getTasksByYear(year, viewType = null) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();

            request.onsuccess = () => {
                let tasks = request.result.filter(task => {
                    const taskDate = new Date(task.targetDate);
                    return taskDate >= startDate && taskDate <= endDate;
                });
                
                if (viewType) {
                    tasks = tasks.filter(task => task.viewType === viewType);
                }
                resolve(tasks);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 根据视图类型获取任务
    async getTasksByViewType(viewType) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const index = store.index('viewType');
            const request = index.getAll(viewType);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 更新任务
    async updateTask(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const task = getRequest.result;
                if (task) {
                    Object.assign(task, updates);
                    const putRequest = store.put(task);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    reject(new Error('Task not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // 删除任务
    async deleteTask(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 获取可用的任务文本列表（按视图类型过滤）
    async getAvailableTaskTexts(viewType = null) {
        let tasks = await this.getAllTasks();
        
        if (viewType) {
            tasks = tasks.filter(task => task.viewType === viewType);
        }
        
        const texts = [...new Set(tasks.map(task => task.text))];
        return texts.sort();
    }

    // 获取每日统计（按视图类型）
    async getDailyStats(date, viewType = null) {
        const tasks = await this.getTasksByDate(date, viewType);
        const completed = tasks.filter(task => task.completed).length;
        const total = tasks.length;
        const progress = total > 0 ? (completed / total) * 100 : 0;

        return {
            completed,
            total,
            progress
        };
    }

    // 获取月度统计（按视图类型）
    async getMonthlyStats(year, month, viewType = null) {
        const tasks = await this.getTasksByMonth(year, month, viewType);
        const taskStats = {};

        tasks.forEach(task => {
            if (!taskStats[task.text]) {
                taskStats[task.text] = {
                    text: task.text,
                    total: 0,
                    completed: 0,
                    progress: 0
                };
            }
            taskStats[task.text].total++;
            if (task.completed) {
                taskStats[task.text].completed++;
            }
        });

        // 计算进度
        Object.values(taskStats).forEach(stat => {
            stat.progress = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
        });

        return Object.values(taskStats).sort((a, b) => b.total - a.total);
    }

    // 获取年度排名（按视图类型）
    async getYearlyRankings(year, viewType = null) {
        const tasks = await this.getTasksByYear(year, viewType);
        const completedTasks = tasks.filter(task => task.completed);
        const taskFrequency = {};
        
        completedTasks.forEach(task => {
            taskFrequency[task.text] = (taskFrequency[task.text] || 0) + 1;
        });
        
        // 转换为排名数据，按频次从高到低排序
        const rankings = Object.entries(taskFrequency)
            .map(([text, count]) => ({
                text: text,
                count: count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // 只取前5名
            
        return rankings;
    }

    // 格式化日期时间
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    // 格式化详细时间
    formatDetailedTime(dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
}
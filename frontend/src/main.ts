import { Game } from './game';
import type { LevelData, SearchResultItem } from './types';
import { healthCheck } from './api';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const game = new Game(canvas);

const levelNumEl = document.getElementById('level-num')!;
const creatureNameEl = document.getElementById('creature-name')!;
const connectedCountEl = document.getElementById('connected-count')!;
const totalCountEl = document.getElementById('total-count')!;
const progressFillEl = document.getElementById('progress-fill')!;
const hintTitleEl = document.getElementById('hint-title')!;
const hintTextEl = document.getElementById('hint-text')!;
const completeModal = document.getElementById('complete-modal')!;
const modalTitleEl = document.getElementById('modal-title')!;
const modalDescEl = document.getElementById('modal-desc')!;

const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnHint = document.getElementById('btn-hint') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;

const btnSearchToggle = document.getElementById('btn-search-toggle') as HTMLButtonElement;
const searchPanel = document.getElementById('search-panel') as HTMLDivElement;
const searchClose = document.getElementById('search-close') as HTMLButtonElement;
const searchNameInput = document.getElementById('search-name') as HTMLInputElement;
const searchFreqMin = document.getElementById('search-freq-min') as HTMLInputElement;
const searchFreqMax = document.getElementById('search-freq-max') as HTMLInputElement;
const btnSearchExec = document.getElementById('btn-search-exec') as HTMLButtonElement;
const btnSearchClear = document.getElementById('btn-search-clear') as HTMLButtonElement;
const searchResultsContainer = document.getElementById('search-results') as HTMLDivElement;

const MAX_LEVELS = 3;

function renderSearchResults(results: SearchResultItem[]): void {
  const countSpan = searchResultsContainer.querySelector('.result-count span')!;
  countSpan.textContent = String(results.length);

  const items = searchResultsContainer.querySelectorAll('.result-item');
  items.forEach(item => item.remove());

  if (results.length === 0) {
    const emptyHint = document.createElement('div');
    emptyHint.style.cssText = 'text-align:center;color:#666;padding:20px 0;font-size:13px;';
    emptyHint.textContent = '未找到匹配的星点';
    searchResultsContainer.appendChild(emptyHint);
    return;
  }

  for (const item of results) {
    const div = document.createElement('div');
    div.className = 'result-item';

    const header = document.createElement('div');
    header.className = 'result-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'result-name';
    nameEl.textContent = item.anchor.name ?? '(未命名)';

    const idEl = document.createElement('span');
    idEl.className = 'result-id';
    idEl.textContent = `ID: ${item.anchor.id}`;

    header.appendChild(nameEl);
    header.appendChild(idEl);
    div.appendChild(header);

    const freqEl = document.createElement('div');
    freqEl.className = 'result-frequency';
    freqEl.textContent = `🔊 ${item.anchor.frequency.toFixed(1)} Hz`;
    div.appendChild(freqEl);

    const connTitle = document.createElement('div');
    connTitle.className = 'result-connections-title';
    connTitle.textContent = `🔗 连接到主星 (${item.connectedMainStars.length}个):`;
    div.appendChild(connTitle);

    const connContainer = document.createElement('div');
    connContainer.className = 'result-connections';

    if (item.connectedMainStars.length === 0) {
      const noConn = document.createElement('span');
      noConn.className = 'no-connections';
      noConn.textContent = '无直接主星连接（辅星/独立星）';
      connContainer.appendChild(noConn);
    } else {
      for (const star of item.connectedMainStars) {
        const tag = document.createElement('span');
        tag.className = 'connection-tag';
        tag.textContent = `${star.name ?? star.id} (${star.frequency.toFixed(1)}Hz)`;
        connContainer.appendChild(tag);
      }
    }

    div.appendChild(connContainer);
    searchResultsContainer.appendChild(div);
  }
}

function executeSearch(): void {
  const nameQuery = searchNameInput.value.trim();
  const minFreqStr = searchFreqMin.value.trim();
  const maxFreqStr = searchFreqMax.value.trim();

  let results: SearchResultItem[] = [];

  if (nameQuery) {
    results = game.searchByName(nameQuery);
  }

  if (minFreqStr || maxFreqStr) {
    const minFreq = minFreqStr ? parseFloat(minFreqStr) : null;
    const maxFreq = maxFreqStr ? parseFloat(maxFreqStr) : null;
    const freqResults = game.searchByFrequencyRange(minFreq, maxFreq);

    if (nameQuery) {
      const existingIds = new Set(results.map(r => r.anchor.id));
      for (const r of freqResults) {
        if (!existingIds.has(r.anchor.id)) {
          results.push(r);
        }
      }
    } else {
      results = freqResults;
    }
  }

  if (!nameQuery && !minFreqStr && !maxFreqStr) {
    game.clearSearchHighlight();
  }

  renderSearchResults(results);
}

function clearSearch(): void {
  searchNameInput.value = '';
  searchFreqMin.value = '';
  searchFreqMax.value = '';
  game.clearSearchHighlight();
  renderSearchResults([]);
}

game.setCallbacks({
  onLevelChange: (level: LevelData) => {
    levelNumEl.textContent = String(level.id);
    creatureNameEl.textContent = level.creatureName;
    totalCountEl.textContent = String(level.edges.length);
    connectedCountEl.textContent = '0';
    progressFillEl.style.width = '0%';
    completeModal.classList.remove('show');

    hintTitleEl.textContent = `关卡 ${level.id}: ${level.name}`;
    hintTextEl.textContent = '寻找闪烁频率成倍数关系的恒星，从一颗星拖动到另一颗星连接它们';
  },
  onProgressChange: (current: number, total: number) => {
    connectedCountEl.textContent = String(current);
    const pct = total > 0 ? (current / total) * 100 : 0;
    progressFillEl.style.width = `${pct}%`;

    if (current < total) {
      if (current === 0) {
        hintTitleEl.textContent = '观察星空';
        hintTextEl.textContent = '仔细观察星星的闪烁节奏，找到频率相同或成倍数的恒星';
      } else if (current < total * 0.3) {
        hintTitleEl.textContent = '初见端倪';
        hintTextEl.textContent = '做得好！继续寻找，你会发现恒星间的谐波共振关系';
      } else if (current < total * 0.6) {
        hintTitleEl.textContent = '星脉初现';
        hintTextEl.textContent = '神话生物的轮廓正在浮现，耐心连接剩余的星脉';
      } else if (current < total) {
        hintTitleEl.textContent = '即将完成';
        hintTextEl.textContent = '只剩最后几颗星了！神话生物即将显现';
      }
    }
  },
  onComplete: (desc: string) => {
    hintTitleEl.textContent = '✨ 星座完成 ✨';
    hintTextEl.textContent = '星界神话生物已显现！仔细欣赏它的光辉吧';

    modalTitleEl.textContent = `✨ ${creatureNameEl.textContent} 降临 ✨`;
    modalDescEl.textContent = desc;
    completeModal.classList.add('show');

    if (game.getCurrentLevel() >= MAX_LEVELS) {
      btnNext.textContent = '重新开始';
    } else {
      btnNext.textContent = '下一关';
    }
  }
});

btnUndo.addEventListener('click', () => {
  game.undoLastConnection();
});

btnReset.addEventListener('click', () => {
  if (confirm('确定要重置本关吗？所有连线将被清除。')) {
    game.resetLevel();
  }
});

btnHint.addEventListener('click', () => {
  const showing = game.toggleFrequencies();
  btnHint.textContent = showing ? '隐藏频率' : '显示频率';
});

btnNext.addEventListener('click', async () => {
  const nextLevel = game.getCurrentLevel() >= MAX_LEVELS
    ? 1
    : game.getCurrentLevel() + 1;

  completeModal.classList.remove('show');
  btnHint.textContent = '显示频率';
  await game.loadLevel(nextLevel);
  clearSearch();
});

btnSearchToggle.addEventListener('click', () => {
  searchPanel.classList.toggle('show');
  if (searchPanel.classList.contains('show')) {
    searchNameInput.focus();
  }
});

searchClose.addEventListener('click', () => {
  searchPanel.classList.remove('show');
});

btnSearchExec.addEventListener('click', executeSearch);

btnSearchClear.addEventListener('click', clearSearch);

searchNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    executeSearch();
  }
});

searchFreqMin.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    executeSearch();
  }
});

searchFreqMax.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    executeSearch();
  }
});

async function init(): Promise<void> {
  hintTitleEl.textContent = '加载中...';
  hintTextEl.textContent = '正在连接星界数据库...';

  try {
    const backendOk = await healthCheck();
    if (!backendOk) {
      console.warn('后端未启动，尝试使用嵌入数据...');
    }
  } catch {
    console.warn('后端健康检查失败');
  }

  const loaded = await game.loadLevel(1);
  if (!loaded) {
    hintTitleEl.textContent = '⚠️ 加载失败';
    hintTextEl.textContent = '无法加载关卡数据，请确保后端服务器已启动 (npm run dev:backend)';
    return;
  }

  game.start();
}

init().catch(err => {
  console.error('初始化失败:', err);
  hintTitleEl.textContent = '错误';
  hintTextEl.textContent = String(err);
});

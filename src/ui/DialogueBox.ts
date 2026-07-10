import { blockGamePointer } from '@/utils/blockGamePointer';
import { typewriterText } from '@/utils/animations';
import { useGameStore } from '@/store/gameStore';

export type DialogueMode = 'intro' | 'objectives' | 'victory';

export interface ObjectiveProgress {
  id: string;
  text: string;
  current: number;
  target: number;
  done: boolean;
  progressLabel: string;
}

export interface VictoryScreenOptions {
  levelName: string;
  stars: number;
  hasNext: boolean;
  isFinal: boolean;
}

export type VictoryAction = 'next' | 'replay' | 'close';

export class DialogueBox {
  private readonly root: HTMLElement;
  private readonly frameEl: HTMLElement;
  private readonly taglineEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly objectivesEl: HTMLElement;
  private readonly nextEl: HTMLElement;
  private readonly continueEl: HTMLElement;
  private readonly minimizeEl: HTMLButtonElement;
  private readonly victoryCardEl: HTMLElement;

  private lines: string[] = [];
  private lineIndex = 0;
  private mode: DialogueMode = 'intro';
  private onAdvance: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private visible = false;
  private objectivesDismissed = false;
  private typewriterToken = 0;
  private previousDoneIds = new Set<string>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'game-dialogue';
    this.root.innerHTML = `
      <div class="game-dialogue__backdrop" data-backdrop hidden></div>
      <div class="game-dialogue__frame" data-frame hidden>
        <div class="game-dialogue__shine" aria-hidden="true"></div>
        <button
          type="button"
          class="game-dialogue__minimize"
          data-minimize
          hidden
          aria-label="Minimizar misión"
          title="Minimizar misión"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 7h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </button>
        <p class="game-dialogue__label" data-label>Misión</p>
        <p class="game-dialogue__tagline" data-tagline hidden></p>
        <h2 class="game-dialogue__title" data-title></h2>
        <p class="game-dialogue__text" data-text></p>
        <ul class="game-dialogue__objectives" data-objectives hidden></ul>
        <div class="game-dialogue__victory-card" data-victory-card hidden>
          <p class="game-dialogue__victory-label">Resultado</p>
          <div class="game-dialogue__stars" data-stars aria-label="Estrellas"></div>
          <div class="game-dialogue__victory-actions">
            <button type="button" class="game-dialogue__victory-btn game-dialogue__victory-btn--primary" data-next-level hidden>
              Siguiente desafío →
            </button>
            <button type="button" class="game-dialogue__victory-btn" data-replay-level>
              Repetir nivel
            </button>
          </div>
        </div>
        <div class="game-dialogue__next" data-next aria-hidden="true">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <path d="M0 0h6v6H0V0zm6 6h6v6H6V6zm6 6h6v8H12v-8z" fill="currentColor"/>
          </svg>
        </div>
        <p class="game-dialogue__continue" data-continue hidden>Clic o Enter para continuar</p>
      </div>
    `;

    this.frameEl = this.root.querySelector('[data-frame]')!;
    this.taglineEl = this.root.querySelector('[data-tagline]')!;
    this.titleEl = this.root.querySelector('[data-title]')!;
    this.textEl = this.root.querySelector('[data-text]')!;
    this.objectivesEl = this.root.querySelector('[data-objectives]')!;
    this.nextEl = this.root.querySelector('[data-next]')!;
    this.continueEl = this.root.querySelector('[data-continue]') as HTMLElement;
    this.minimizeEl = this.root.querySelector('[data-minimize]') as HTMLButtonElement;
    this.victoryCardEl = this.root.querySelector('[data-victory-card]') as HTMLElement;

    const backdrop = this.root.querySelector('[data-backdrop]') as HTMLElement;
    blockGamePointer(this.frameEl);
    blockGamePointer(backdrop);

    this.frameEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-victory-card]')) return;
      this.advance();
    });
    backdrop.addEventListener('click', () => this.advance());
    this.minimizeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissObjectives();
    });
  }

  dispose(): void {
    this.detachKeys();
    this.root.replaceChildren();
    this.root.className = '';
  }

  async playLines(
    mode: 'intro' | 'victory',
    title: string,
    lines: string[],
    tagline?: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.mode = mode;
      this.lines = lines;
      this.lineIndex = 0;
      this.onAdvance = () => {
        this.typewriterToken += 1;
        if (this.lineIndex < this.lines.length - 1) {
          this.lineIndex += 1;
          void this.renderLine();
        } else {
          this.hide();
          resolve();
        }
      };

      this.root.classList.toggle('game-dialogue--victory', mode === 'victory');
      this.titleEl.textContent = title;
      this.setTagline(tagline);
      this.objectivesEl.hidden = true;
      this.victoryCardEl.hidden = true;
      this.textEl.hidden = false;
      this.show(true);
      void this.renderLine();
      this.attachKeys();
    });
  }

  showObjectives(title: string, tagline: string, objectives: ObjectiveProgress[]): void {
    this.mode = 'objectives';
    this.objectivesDismissed = false;
    this.detachKeys();
    this.onAdvance = null;
    this.root.classList.remove('game-dialogue--victory');
    this.titleEl.textContent = title;
    this.setTagline(tagline);
    this.textEl.hidden = true;
    this.victoryCardEl.hidden = true;
    this.objectivesEl.hidden = false;
    this.minimizeEl.hidden = false;
    this.previousDoneIds = new Set(objectives.filter((o) => o.done).map((o) => o.id));
    this.renderObjectives(objectives);
    this.show(false);
    window.setTimeout(() => {
      if (this.mode === 'objectives' && !this.objectivesDismissed && this.visible) {
        this.dismissObjectives();
      }
    }, 900);
  }

  updateObjectives(objectives: ObjectiveProgress[]): void {
    if (this.mode !== 'objectives' || this.objectivesDismissed) return;
    this.renderObjectives(objectives, this.previousDoneIds);
    for (const obj of objectives) {
      if (obj.done) {
        this.previousDoneIds.add(obj.id);
      }
    }
  }

  showVictoryScreen(options: VictoryScreenOptions): Promise<VictoryAction> {
    return new Promise((resolve) => {
      this.mode = 'objectives';
      this.detachKeys();
      this.onAdvance = null;
      this.root.classList.add('game-dialogue--victory');
      this.titleEl.textContent = options.levelName;
      this.setTagline(options.isFinal ? '¡Campaña completada!' : '¡Victoria!');
      this.textEl.hidden = true;
      this.objectivesEl.hidden = true;
      this.victoryCardEl.hidden = false;
      this.minimizeEl.hidden = true;

      const starsEl = this.victoryCardEl.querySelector('[data-stars]') as HTMLElement;
      starsEl.innerHTML = '';
      for (let i = 1; i <= 3; i += 1) {
        const star = document.createElement('span');
        star.className = 'game-dialogue__star';
        star.textContent = '★';
        if (i <= options.stars) {
          star.classList.add('is-earned');
          star.style.animationDelay = `${i * 0.15}s`;
        }
        starsEl.appendChild(star);
      }

      const nextBtn = this.victoryCardEl.querySelector('[data-next-level]') as HTMLButtonElement;
      const replayBtn = this.victoryCardEl.querySelector('[data-replay-level]') as HTMLButtonElement;
      nextBtn.hidden = !options.hasNext;
      nextBtn.textContent = options.isFinal ? '' : 'Siguiente desafío →';

      const finish = (action: VictoryAction) => {
        nextBtn.removeEventListener('click', onNext);
        replayBtn.removeEventListener('click', onReplay);
        resolve(action);
      };

      const onNext = (e: Event) => {
        e.stopPropagation();
        finish('next');
      };
      const onReplay = (e: Event) => {
        e.stopPropagation();
        finish('replay');
      };

      nextBtn.addEventListener('click', onNext);
      replayBtn.addEventListener('click', onReplay);

      this.show(true);
      this.frameEl.classList.remove('is-entering');
      void this.frameEl.offsetWidth;
      this.frameEl.classList.add('is-entering');
    });
  }

  hide(): void {
    this.visible = false;
    this.objectivesDismissed = false;
    this.typewriterToken += 1;
    this.detachKeys();
    useGameStore.getState().setDialogueBlocking(false);
    this.root.classList.remove('is-visible', 'game-dialogue--overlay');
    const frame = this.root.querySelector('[data-frame]') as HTMLElement;
    const backdrop = this.root.querySelector('[data-backdrop]') as HTMLElement;
    frame.hidden = true;
    backdrop.hidden = true;
    this.minimizeEl.hidden = true;
    this.victoryCardEl.hidden = true;
  }

  private setTagline(tagline?: string): void {
    if (tagline) {
      this.taglineEl.textContent = tagline;
      this.taglineEl.hidden = false;
    } else {
      this.taglineEl.hidden = true;
    }
  }

  private show(overlay: boolean): void {
    this.visible = true;
    const frame = this.root.querySelector('[data-frame]') as HTMLElement;
    const backdrop = this.root.querySelector('[data-backdrop]') as HTMLElement;
    frame.hidden = false;
    backdrop.hidden = !overlay;
    this.minimizeEl.hidden = this.mode !== 'objectives' || !this.victoryCardEl.hidden;
    this.continueEl.hidden = !overlay || !this.victoryCardEl.hidden;
    this.root.classList.add('is-visible');
    this.root.classList.toggle('game-dialogue--overlay', overlay);
    useGameStore.getState().setDialogueBlocking(overlay);
    if (!overlay) {
      frame.classList.remove('is-entering');
      void frame.offsetWidth;
      frame.classList.add('is-entering');
    }
  }

  private dismissObjectives(): void {
    if (this.mode !== 'objectives' || this.objectivesDismissed) return;

    this.objectivesDismissed = true;
    this.frameEl.hidden = true;
    this.minimizeEl.hidden = true;
    this.visible = false;
    this.root.classList.remove('is-visible');
  }

  private async renderLine(): Promise<void> {
    const line = this.lines[this.lineIndex] ?? '';
    const token = ++this.typewriterToken;
    const hasMore = this.lineIndex < this.lines.length - 1;
    this.nextEl.hidden = !hasMore;
    this.nextEl.setAttribute('aria-hidden', hasMore ? 'false' : 'true');
    await typewriterText(this.textEl, line);
    if (token !== this.typewriterToken) return;
  }

  private renderObjectives(
    objectives: ObjectiveProgress[],
    previousDone = this.previousDoneIds,
  ): void {
    this.objectivesEl.replaceChildren();

    for (const obj of objectives) {
      const li = document.createElement('li');
      li.className = 'game-dialogue__objective';
      li.dataset.objectiveId = obj.id;
      if (obj.done) li.classList.add('is-done');
      if (obj.done && !previousDone.has(obj.id)) {
        li.classList.add('is-just-done');
      }

      const check = document.createElement('span');
      check.className = 'game-dialogue__check';
      check.textContent = obj.done ? '✓' : '○';

      const label = document.createElement('span');
      label.className = 'game-dialogue__objective-text';
      label.textContent = obj.text;

      const progress = document.createElement('span');
      progress.className = 'game-dialogue__progress';
      progress.textContent = obj.progressLabel;

      li.append(check, label, progress);
      this.objectivesEl.appendChild(li);
    }

    const allDone = objectives.length > 0 && objectives.every((o) => o.done);
    this.objectivesEl.classList.toggle('is-complete', allDone);
  }

  private advance(): void {
    if (!this.visible || this.mode === 'objectives') return;
    if (!this.victoryCardEl.hidden) return;
    this.typewriterToken += 1;
    this.textEl.textContent = this.lines[this.lineIndex] ?? '';
    this.onAdvance?.();
  }

  private attachKeys(): void {
    this.detachKeys();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.advance();
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  private detachKeys(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
  }
}

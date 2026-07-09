import { blockGamePointer } from '@/utils/blockGamePointer';
import { prefersReducedMotion, typewriterText } from '@/utils/animations';
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
  private readonly dockEl: HTMLButtonElement;
  private readonly dockBadgeEl: HTMLElement;
  private readonly victoryCardEl: HTMLElement;

  private lines: string[] = [];
  private lineIndex = 0;
  private mode: DialogueMode = 'intro';
  private onAdvance: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private visible = false;
  private minimized = false;
  private animating = false;
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
      <button
        type="button"
        class="game-dialogue__dock is-dock-hidden"
        data-dock
        aria-label="Mostrar misión"
        title="Mostrar misión"
      >
        <svg class="game-dialogue__dock-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="game-dialogue__dock-badge" data-dock-badge></span>
      </button>
    `;

    this.frameEl = this.root.querySelector('[data-frame]')!;
    this.taglineEl = this.root.querySelector('[data-tagline]')!;
    this.titleEl = this.root.querySelector('[data-title]')!;
    this.textEl = this.root.querySelector('[data-text]')!;
    this.objectivesEl = this.root.querySelector('[data-objectives]')!;
    this.nextEl = this.root.querySelector('[data-next]')!;
    this.continueEl = this.root.querySelector('[data-continue]') as HTMLElement;
    this.minimizeEl = this.root.querySelector('[data-minimize]') as HTMLButtonElement;
    this.dockEl = this.root.querySelector('[data-dock]') as HTMLButtonElement;
    this.dockBadgeEl = this.root.querySelector('[data-dock-badge]') as HTMLElement;
    this.victoryCardEl = this.root.querySelector('[data-victory-card]') as HTMLElement;

    const backdrop = this.root.querySelector('[data-backdrop]') as HTMLElement;
    blockGamePointer(this.frameEl);
    blockGamePointer(backdrop);
    blockGamePointer(this.dockEl);

    this.frameEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-victory-card]')) return;
      this.advance();
    });
    backdrop.addEventListener('click', () => this.advance());
    this.minimizeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.minimizeObjectives();
    });
    this.dockEl.addEventListener('click', () => {
      void this.restoreObjectives();
    });
  }

  dispose(): void {
    this.detachKeys();
    this.dockEl.remove();
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
    this.minimized = false;
    this.detachKeys();
    this.onAdvance = null;
    this.root.classList.remove('game-dialogue--victory', 'game-dialogue--minimized');
    this.titleEl.textContent = title;
    this.setTagline(tagline);
    this.textEl.hidden = true;
    this.victoryCardEl.hidden = true;
    this.objectivesEl.hidden = false;
    this.minimizeEl.hidden = false;
    this.previousDoneIds = new Set(objectives.filter((o) => o.done).map((o) => o.id));
    this.renderObjectives(objectives);
    this.updateDockBadge(objectives);
    this.hideDock();
    this.resetFrameLayout();
    this.show(false);
    window.setTimeout(() => {
      if (this.mode === 'objectives' && !this.minimized && this.visible) {
        void this.minimizeObjectives();
      }
    }, 900);
  }

  updateObjectives(objectives: ObjectiveProgress[]): void {
    if (this.mode !== 'objectives') return;
    this.renderObjectives(objectives, this.previousDoneIds);
    for (const obj of objectives) {
      if (obj.done) {
        this.previousDoneIds.add(obj.id);
      }
    }
    this.updateDockBadge(objectives);
    if (this.minimized) {
      this.dockEl.classList.remove('is-bouncing');
      void this.dockEl.offsetWidth;
      this.dockEl.classList.add('is-bouncing');
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
    this.minimized = false;
    this.animating = false;
    this.typewriterToken += 1;
    this.detachKeys();
    useGameStore.getState().setDialogueBlocking(false);
    this.root.classList.remove('is-visible', 'game-dialogue--overlay', 'game-dialogue--minimized');
    const frame = this.root.querySelector('[data-frame]') as HTMLElement;
    const backdrop = this.root.querySelector('[data-backdrop]') as HTMLElement;
    frame.hidden = true;
    backdrop.hidden = true;
    this.hideDock();
    this.minimizeEl.hidden = true;
    this.victoryCardEl.hidden = true;
    this.resetFrameLayout();
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

  private async minimizeObjectives(): Promise<void> {
    if (this.mode !== 'objectives' || this.minimized || this.animating) return;

    this.animating = true;
    try {
      this.showDock();
      void this.dockEl.offsetWidth;

      const from = this.frameEl.getBoundingClientRect();
      const to = this.dockEl.getBoundingClientRect();

      this.frameEl.getAnimations().forEach((anim) => anim.cancel());
      this.pinFrameToRect(from);

      await this.animateFrameBetween(from, to, 'minimize');

      this.frameEl.hidden = true;
      this.frameEl.getAnimations().forEach((anim) => anim.cancel());
      this.resetFrameLayout();
      this.minimized = true;
      this.root.classList.add('game-dialogue--minimized');
      this.dockEl.classList.remove('is-bouncing');
      void this.dockEl.offsetWidth;
      this.dockEl.classList.add('is-bouncing');
    } finally {
      this.animating = false;
    }
  }

  private async restoreObjectives(): Promise<void> {
    if (this.mode !== 'objectives' || !this.minimized || this.animating) return;

    this.animating = true;
    try {
      this.root.classList.remove('game-dialogue--minimized');

      const from = this.dockEl.getBoundingClientRect();
      this.frameEl.hidden = false;
      this.resetFrameLayout();
      this.frameEl.style.visibility = 'hidden';
      const to = this.frameEl.getBoundingClientRect();
      this.pinFrameToRect(from);
      this.frameEl.style.visibility = 'visible';
      this.frameEl.style.opacity = '0.92';

      this.frameEl.getAnimations().forEach((anim) => anim.cancel());
      await this.animateFrameBetween(from, to, 'restore');

      this.frameEl.getAnimations().forEach((anim) => anim.cancel());
      this.resetFrameLayout();
      this.frameEl.style.opacity = '';
      this.hideDock();
      this.minimized = false;

      this.frameEl.classList.remove('is-entering');
      void this.frameEl.offsetWidth;
      this.frameEl.classList.add('is-entering');
    } finally {
      this.animating = false;
    }
  }

  private showDock(): void {
    this.dockEl.classList.remove('is-dock-hidden');
    this.dockEl.setAttribute('aria-hidden', 'false');
  }

  private hideDock(): void {
    this.dockEl.classList.add('is-dock-hidden');
    this.dockEl.classList.remove('is-bouncing');
    this.dockEl.setAttribute('aria-hidden', 'true');
  }

  private pinFrameToRect(rect: DOMRect): void {
    this.frameEl.style.left = `${rect.left}px`;
    this.frameEl.style.top = `${rect.top}px`;
    this.frameEl.style.bottom = 'auto';
    this.frameEl.style.width = `${rect.width}px`;
    this.frameEl.style.height = `${rect.height}px`;
    this.frameEl.style.transform = 'none';
    this.frameEl.style.margin = '0';
  }

  private resetFrameLayout(): void {
    this.frameEl.style.left = '';
    this.frameEl.style.top = '';
    this.frameEl.style.bottom = '';
    this.frameEl.style.width = '';
    this.frameEl.style.height = '';
    this.frameEl.style.transform = '';
    this.frameEl.style.margin = '';
    this.frameEl.style.opacity = '';
    this.frameEl.style.borderRadius = '';
  }

  private animateFrameBetween(
    from: DOMRect,
    to: DOMRect,
    direction: 'minimize' | 'restore',
  ): Promise<void> {
    const reduced = prefersReducedMotion();
    const duration = reduced ? 120 : direction === 'minimize' ? 580 : 520;
    const easing = 'cubic-bezier(0.32, 0.72, 0, 1)';

    const animation = this.frameEl.animate(
      [
        {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          opacity: direction === 'minimize' ? 1 : 0.85,
          borderRadius: direction === 'minimize' ? '0px' : '14px',
          filter: 'blur(0px)',
        },
        {
          left: `${from.left + (to.left - from.left) * 0.55}px`,
          top: `${from.top + (to.top - from.top) * 0.72}px`,
          width: `${from.width * 0.42 + to.width * 0.58}px`,
          height: `${from.height * 0.35 + to.height * 0.65}px`,
          opacity: 0.92,
          borderRadius: '10px',
          filter: 'blur(0px)',
          offset: 0.62,
        },
        {
          left: `${to.left}px`,
          top: `${to.top}px`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          opacity: direction === 'minimize' ? 0 : 1,
          borderRadius: '14px',
          filter: reduced ? 'blur(0px)' : 'blur(1px)',
        },
      ],
      { duration, easing, fill: 'forwards' },
    );

    return animation.finished.then(() => undefined);
  }

  private updateDockBadge(objectives: ObjectiveProgress[]): void {
    const done = objectives.filter((o) => o.done).length;
    const total = objectives.length;
    this.dockBadgeEl.textContent = total > 0 ? `${done}/${total}` : '';
    this.dockBadgeEl.hidden = total === 0;
    this.dockEl.classList.toggle('is-complete', total > 0 && done === total);
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

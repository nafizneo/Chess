const PIECES = { EMPTY: 0, wP: 1, wN: 2, wB: 3, wR: 4, wQ: 5, wK: 6, bP: 7, bN: 8, bB: 9, bR: 10, bQ: 11, bK: 12 };

const V = { [PIECES.wP]: 100, [PIECES.wN]: 320, [PIECES.wB]: 330, [PIECES.wR]: 500, [PIECES.wQ]: 900, [PIECES.wK]: 20000 };
Object.keys(V).forEach(k => V[parseInt(k) + 6] = V[k]);

const PST = {
    [PIECES.wP]: [
        0,  0,  0,  0,  0,  0,  0,  0, 50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10, 5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0, 5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5, 0,  0,  0,  0,  0,  0,  0,  0
    ],
    [PIECES.wN]: [
        -50,-40,-30,-30,-30,-30,-40,-50,-40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30, -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30, -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50
    ]
};

class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = new Int8Array(64);
        this.turn = 'w';
        this.history = [];
        this.setupStartingPosition();
    }

    setupStartingPosition() {
        const layout = [
            'bR','bN','bB','bQ','bK','bB','bN','bR',
            'bP','bP','bP','bP','bP','bP','bP','bP',
            ...Array(32).fill(null),
            'wP','wP','wP','wP','wP','wP','wP','wP',
            'wR','wN','wB','wQ','wK','wB','wN','wR'
        ];
        layout.forEach((p, i) => { if(p) this.board[i] = PIECES[p]; });
    }

    getPieceColor(piece) {
        if (piece === 0) return null;
        return piece <= 6 ? 'w' : 'b';
    }

    generateMoves(color = this.turn, onlyCaptures = false) {
        const moves = [];
        for (let i = 0; i < 64; i++) {
            const piece = this.board[i];
            if (this.getPieceColor(piece) !== color) continue;
            const type = piece > 6 ? piece - 6 : piece;
            
            if (type === PIECES.wP) this.generatePawnMoves(i, color, moves, onlyCaptures);
            else if (type === PIECES.wN || type === PIECES.wK) this.generateStepMoves(i, this.getDirs(type), moves, color, onlyCaptures);
            else this.generateSlidingMoves(i, this.getDirs(type), moves, color, onlyCaptures);
        }
        return moves;
    }

    getDirs(type) {
        if (type === PIECES.wN) return [-17, -15, -10, -6, 6, 10, 15, 17];
        if (type === PIECES.wB) return [-9, -7, 7, 9];
        if (type === PIECES.wR) return [-8, -1, 1, 8];
        return [-9, -8, -7, -1, 1, 7, 8, 9];
    }

    generateSlidingMoves(pos, dirs, moves, color, onlyCaptures) {
        dirs.forEach(d => {
            let next = pos;
            while (true) {
                const prev = next;
                next += d;
                if (next < 0 || next >= 64 || Math.abs((prev % 8) - (next % 8)) > 1) break;
                const target = this.board[next];
                if (target === 0) { if (!onlyCaptures) moves.push({ from: pos, to: next }); }
                else { if (this.getPieceColor(target) !== color) moves.push({ from: pos, to: next, capture: true }); break; }
            }
        });
    }

    generateStepMoves(pos, dirs, moves, color, onlyCaptures) {
        dirs.forEach(d => {
            const next = pos + d;
            if (next >= 0 && next < 64 && Math.abs((pos % 8) - (next % 8)) <= 2) {
                const target = this.board[next];
                if (target === 0) { if (!onlyCaptures) moves.push({ from: pos, to: next }); }
                else if (this.getPieceColor(target) !== color) moves.push({ from: pos, to: next, capture: true });
            }
        });
    }

    generatePawnMoves(pos, color, moves, onlyCaptures) {
        const dir = color === 'w' ? -8 : 8;
        if (!onlyCaptures && this.board[pos + dir] === 0) {
            moves.push({ from: pos, to: pos + dir });
            const startRank = color === 'w' ? 6 : 1;
            if (Math.floor(pos / 8) === startRank && this.board[pos + dir * 2] === 0) moves.push({ from: pos, to: pos + dir * 2 });
        }
        [-1, 1].forEach(side => {
            const target = pos + dir + side;
            if (Math.abs(((pos + side) % 8) - (pos % 8)) <= 1) {
                const piece = this.board[target];
                if (piece !== 0 && this.getPieceColor(piece) !== color) moves.push({ from: pos, to: target, capture: true });
            }
        });
    }

    makeMove(move) {
        const piece = this.board[move.from];
        this.history.push({ move, boardBefore: new Int8Array(this.board), turn: this.turn });
        this.board[move.to] = piece;
        this.board[move.from] = 0;
        if ((piece === PIECES.wP && move.to < 8)) this.board[move.to] = PIECES.wQ;
        if ((piece === PIECES.bP && move.to > 55)) this.board[move.to] = PIECES.bQ;
        this.turn = this.turn === 'w' ? 'b' : 'w';
    }

    undo() {
        if (this.history.length === 0) return;
        const last = this.history.pop();
        this.board = last.boardBefore;
        this.turn = last.turn;
    }
}

class ChessAI {
    constructor(engine) {
        this.engine = engine;
    }

    evaluate(engine) {
        let score = 0;
        for (let i = 0; i < 64; i++) {
            const p = engine.board[i];
            if (p === 0) continue;
            const val = V[p] + (PST[p] ? PST[p][i] : 0);
            score += (p <= 6) ? val : -val;
        }
        return score;
    }

    search(depth, alpha, beta, isMax) {
        if (depth === 0) return this.evaluate(this.engine);
        const moves = this.engine.generateMoves().sort((a,b) => (b.capture?1:0) - (a.capture?1:0));
        if (moves.length === 0) return isMax ? -30000 : 30000;

        let best = isMax ? -Infinity : Infinity;
        for (const m of moves) {
            this.engine.makeMove(m);
            const val = this.search(depth - 1, alpha, beta, !isMax);
            this.engine.undo();
            if (isMax) { best = Math.max(best, val); alpha = Math.max(alpha, best); }
            else { best = Math.min(best, val); beta = Math.min(beta, best); }
            if (beta <= alpha) break;
        }
        return best;
    }

    getBestMove(depth) {
        let bestMove = null;
        let bestVal = this.engine.turn === 'w' ? -Infinity : Infinity;
        const moves = this.engine.generateMoves();
        for (const m of moves) {
            this.engine.makeMove(m);
            const val = this.search(depth - 1, -Infinity, Infinity, this.engine.turn === 'w');
            this.engine.undo();
            if ((this.engine.turn === 'w' && val > bestVal) || (this.engine.turn === 'b' && val < bestVal)) {
                bestVal = val; bestMove = m;
            }
        }
        return bestMove;
    }
}

class ChessUI {
    constructor() {
        this.engine = new ChessEngine();
        this.ai = new ChessAI(this.engine);
        this.selectedSquare = null;
        this.difficulty = 3;
        this.useAI = true;
        this.initBoard();
        this.render();
    }

    initBoard() {
        const boardEl = document.getElementById('main-board');
        boardEl.innerHTML = '';
        for (let i = 0; i < 64; i++) {
            const sq = document.createElement('div');
            sq.className = `square ${(Math.floor(i/8) + i%8) % 2 === 0 ? 'light' : 'dark'}`;
            sq.onclick = (e) => { e.preventDefault(); this.handleSquareClick(i); };
            boardEl.appendChild(sq);
        }
    }

    handleSquareClick(i) {
        const piece = this.engine.board[i];
        const color = this.engine.getPieceColor(piece);
        if (this.selectedSquare === null) {
            if (color === this.engine.turn) { this.selectedSquare = i; this.render(); }
        } else {
            const moves = this.engine.generateMoves();
            const move = moves.find(m => m.from === this.selectedSquare && m.to === i);
            if (move) this.executeMove(move);
            else { this.selectedSquare = (color === this.engine.turn) ? i : null; this.render(); }
        }
    }

    executeMove(move) {
        this.engine.makeMove(move);
        this.selectedSquare = null;
        this.render();
        if (this.useAI && this.engine.turn === 'b') {
            setTimeout(() => {
                const aiMove = this.ai.getBestMove(this.difficulty);
                if (aiMove) { this.engine.makeMove(aiMove); this.render(); }
            }, 250);
        }
    }

    render() {
        const squares = document.querySelectorAll('.square');
        const moves = this.selectedSquare !== null ? this.engine.generateMoves().filter(m => m.from === this.selectedSquare) : [];
        squares.forEach((sq, i) => {
            sq.innerHTML = '';
            sq.classList.remove('selected');
            const piece = this.engine.board[i];
            if (piece !== 0) {
                const pEl = document.createElement('div');
                pEl.className = `piece ${Object.keys(PIECES).find(key => PIECES[key] === piece)}`;
                sq.appendChild(pEl);
            }
            if (i === this.selectedSquare) sq.classList.add('selected');
            if (moves.some(m => m.to === i)) {
                const dot = document.createElement('div');
                dot.className = 'legal-dot';
                sq.appendChild(dot);
            }
        });
        const evalScore = this.ai.evaluate(this.engine) / 100;
        document.getElementById('eval-text').innerText = `Eval: ${evalScore > 0 ? '+' : ''}${evalScore.toFixed(1)}`;
        document.getElementById('eval-fill').style.width = `${Math.max(5, Math.min(95, 50 + (evalScore * 5)))}%`;
        document.getElementById('game-status').innerText = `${this.engine.turn === 'w' ? 'WHITE' : 'BLACK'} TO MOVE`;
        this.updateHistory();
    }

    updateHistory() {
        const histEl = document.getElementById('history');
        histEl.innerHTML = '';
        this.engine.history.forEach((h, idx) => {
            if (idx % 2 === 0) {
                const span = document.createElement('div');
                span.innerText = (Math.floor(idx/2) + 1) + '.';
                histEl.appendChild(span);
            }
            const m = document.createElement('div');
            m.innerText = this.iToC(h.move.from) + '→' + this.iToC(h.move.to);
            histEl.appendChild(m);
        });
        histEl.scrollTop = histEl.scrollHeight;
    }

    iToC(i) { return ['a','b','c','d','e','f','g','h'][i % 8] + (8 - Math.floor(i / 8)); }
    undo() { this.engine.undo(); if(this.useAI) this.engine.undo(); this.render(); }
    reset() { this.engine.reset(); this.render(); }
    toggleAI() { this.useAI = !this.useAI; document.getElementById('ai-toggle').innerText = `AI: ${this.useAI ? 'ON' : 'OFF'}`; }
    setDifficulty(d) { this.difficulty = parseInt(d); }
}

const gameUI = new ChessUI();

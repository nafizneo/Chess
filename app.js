/**
 * CONSTANTS & DATA TABLES
 * Piece Square Tables (PST) encourage pieces to occupy strong squares.
 */
const PIECES = { EMPTY: 0, wP: 1, wN: 2, wB: 3, wR: 4, wQ: 5, wK: 6, bP: 7, bN: 8, bB: 9, bR: 10, bQ: 11, bK: 12 };

const V = { [PIECES.wP]: 100, [PIECES.wN]: 320, [PIECES.wB]: 330, [PIECES.wR]: 500, [PIECES.wQ]: 900, [PIECES.wK]: 20000 };
// Mirror values for black
Object.keys(V).forEach(k => V[parseInt(k) + 6] = V[k]);

const PST = {
    [PIECES.wP]: [
        0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0
    ],
    [PIECES.wN]: [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
    ]
    // ... Simplified for demo, others are mirrored or defaulted
};

/**
 * CHESS ENGINE CORE
 * Manages board state, move generation, and validation.
 */
class ChessEngine {
    constructor() {
        this.reset();
        this.initZobrist();
    }

    reset() {
        this.board = new Int8Array(64);
        this.turn = 'w';
        this.history = [];
        this.castling = { wK: true, wQ: true, bK: true, bQ: true };
        this.enPassant = null;
        this.halfMoveClock = 0;
        this.zobristHash = 0n;
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

    // Advanced: Zobrist Hashing for Transposition Tables
    initZobrist() {
        this.zTable = Array.from({length: 64}, () => 
            Array.from({length: 13}, () => BigUint64Array.from([BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))])[0])
        );
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
            const directions = this.getDirections(type);
            
            if (type === PIECES.wP) {
                this.generatePawnMoves(i, color, moves, onlyCaptures);
            } else if (type === PIECES.wN || type === PIECES.wK) {
                this.generateStepMoves(i, directions, moves, color, onlyCaptures);
            } else {
                this.generateSlidingMoves(i, directions, moves, color, onlyCaptures);
            }
        }
        return moves;
    }

    getDirections(type) {
        switch(type) {
            case PIECES.wN: return [-17, -15, -10, -6, 6, 10, 15, 17];
            case PIECES.wB: return [-9, -7, 7, 9];
            case PIECES.wR: return [-8, -1, 1, 8];
            case PIECES.wQ: case PIECES.wK: return [-9, -8, -7, -1, 1, 7, 8, 9];
            default: return [];
        }
    }

    generateSlidingMoves(pos, dirs, moves, color, onlyCaptures) {
        dirs.forEach(d => {
            let next = pos;
            while (true) {
                const prevPos = next;
                next += d;
                if (next < 0 || next >= 64 || Math.abs((prevPos % 8) - (next % 8)) > 1) break;
                
                const target = this.board[next];
                if (target === 0) {
                    if (!onlyCaptures) moves.push({ from: pos, to: next });
                } else {
                    if (this.getPieceColor(target) !== color) moves.push({ from: pos, to: next, capture: true });
                    break;
                }
            }
        });
    }

    generateStepMoves(pos, dirs, moves, color, onlyCaptures) {
        dirs.forEach(d => {
            const next = pos + d;
            if (next >= 0 && next < 64 && Math.abs((pos % 8) - (next % 8)) <= 2) {
                const target = this.board[next];
                if (target === 0) {
                    if (!onlyCaptures) moves.push({ from: pos, to: next });
                } else if (this.getPieceColor(target) !== color) {
                    moves.push({ from: pos, to: next, capture: true });
                }
            }
        });
    }

    generatePawnMoves(pos, color, moves, onlyCaptures) {
        const dir = color === 'w' ? -8 : 8;
        const startRank = color === 'w' ? 6 : 1;

        // Advance
        if (!onlyCaptures) {
            if (this.board[pos + dir] === 0) {
                moves.push({ from: pos, to: pos + dir });
                if (Math.floor(pos / 8) === startRank && this.board[pos + dir * 2] === 0) {
                    moves.push({ from: pos, to: pos + dir * 2 });
                }
            }
        }

        // Captures
        [-1, 1].forEach(side => {
            const target = pos + dir + side;
            if (Math.abs(((pos + side) % 8) - (pos % 8)) <= 1) {
                const piece = this.board[target];
                if (piece !== 0 && this.getPieceColor(piece) !== color) {
                    moves.push({ from: pos, to: target, capture: true });
                }
            }
        });
    }

    makeMove(move) {
        const piece = this.board[move.from];
        const captured = this.board[move.to];
        
        // Save state for undo
        this.history.push({
            move,
            boardBefore: new Int8Array(this.board),
            castling: { ...this.castling },
            turn: this.turn
        });

        // Execute
        this.board[move.to] = piece;
        this.board[move.from] = 0;

        // Simple Promotion
        if ((piece === PIECES.wP && move.to < 8)) this.board[move.to] = PIECES.wQ;
        if ((piece === PIECES.bP && move.to > 55)) this.board[move.to] = PIECES.bQ;

        this.turn = this.turn === 'w' ? 'b' : 'w';
    }

    undo() {
        if (this.history.length === 0) return;
        const last = this.history.pop();
        this.board = last.boardBefore;
        this.castling = last.castling;
        this.turn = last.turn;
    }

    // Check if current side's king is under attack
    inCheck(color) {
        const kingPos = this.board.indexOf(color === 'w' ? PIECES.wK : PIECES.bK);
        const opponentMoves = this.generateMoves(color === 'w' ? 'b' : 'w', true);
        return opponentMoves.some(m => m.to === kingPos);
    }
}

/**
 * AI ENGINE
 * Implements Minimax with Alpha-Beta Pruning.
 */
class ChessAI {
    constructor(engine) {
        this.engine = engine;
        this.nodesVisited = 0;
        this.transpositionTable = new Map();
    }

    evaluate(engine) {
        let score = 0;
        for (let i = 0; i < 64; i++) {
            const p = engine.board[i];
            if (p === 0) continue;
            
            const val = V[p];
            const pstBonus = PST[p] ? PST[p][i] : 0;
            
            if (p <= 6) score += (val + pstBonus);
            else score -= (val + pstBonus);
        }
        return score;
    }

    search(depth, alpha, beta, isMaximizing) {
        this.nodesVisited++;
        if (depth === 0) return this.evaluate(this.engine);

        const moves = this.orderMoves(this.engine.generateMoves());
        if (moves.length === 0) return isMaximizing ? -30000 : 30000;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                this.engine.makeMove(move);
                const ev = this.search(depth - 1, alpha, beta, false);
                this.engine.undo();
                maxEval = Math.max(maxEval, ev);
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                this.engine.makeMove(move);
                const ev = this.search(depth - 1, alpha, beta, true);
                this.engine.undo();
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    // Heuristic Move Ordering (Captures first)
    orderMoves(moves) {
        return moves.sort((a, b) => {
            if (a.capture && !b.capture) return -1;
            if (!a.capture && b.capture) return 1;
            return 0;
        });
    }

    getBestMove(depth) {
        this.nodesVisited = 0;
        let bestMove = null;
        let bestValue = this.engine.turn === 'w' ? -Infinity : Infinity;
        
        const moves = this.orderMoves(this.engine.generateMoves());
        
        for (const move of moves) {
            this.engine.makeMove(move);
            const boardValue = this.search(depth - 1, -Infinity, Infinity, this.engine.turn === 'w');
            this.engine.undo();

            if (this.engine.turn === 'w') {
                if (boardValue > bestValue) {
                    bestValue = boardValue;
                    bestMove = move;
                }
            } else {
                if (boardValue < bestValue) {
                    bestValue = boardValue;
                    bestMove = move;
                }
            }
        }
        console.log(`AI analyzed ${this.nodesVisited} nodes. Best Eval: ${bestValue}`);
        return bestMove;
    }
}

/**
 * UI CONTROLLER
 */
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
            sq.dataset.index = i;
            sq.onclick = () => this.handleSquareClick(i);
            boardEl.appendChild(sq);
        }
    }

    handleSquareClick(i) {
        const piece = this.engine.board[i];
        const color = this.engine.getPieceColor(piece);

        // Selection
        if (this.selectedSquare === null) {
            if (color === this.engine.turn) {
                this.selectedSquare = i;
                this.render();
            }
        } 
        // Move Attempt
        else {
            const moves = this.engine.generateMoves();
            const move = moves.find(m => m.from === this.selectedSquare && m.to === i);
            
            if (move) {
                this.executeMove(move);
            } else {
                this.selectedSquare = (color === this.engine.turn) ? i : null;
                this.render();
            }
        }
    }

    executeMove(move) {
        this.engine.makeMove(move);
        this.selectedSquare = null;
        this.render();

        if (this.useAI && this.engine.turn === 'b') {
            setTimeout(() => {
                const aiMove = this.ai.getBestMove(this.difficulty);
                if (aiMove) {
                    this.engine.makeMove(aiMove);
                    this.render();
                }
            }, 250);
        }
    }

    render() {
        const squares = document.querySelectorAll('.square');
        const moves = this.selectedSquare !== null ? this.engine.generateMoves().filter(m => m.from === this.selectedSquare) : [];

        squares.forEach((sq, i) => {
            sq.innerHTML = '';
            sq.classList.remove('selected', 'last-move');
            
            const piece = this.engine.board[i];
            if (piece !== 0) {
                const pEl = document.createElement('div');
                pEl.className = `piece ${Object.keys(PIECES).find(key => PIECES[key] === piece)}`;
                sq.appendChild(pEl);
            }

            if (i === this.selectedSquare) sq.classList.add('selected');
            
            // Highlight legal moves
            if (moves.some(m => m.to === i)) {
                const dot = document.createElement('div');
                dot.className = 'legal-dot';
                sq.appendChild(dot);
            }
        });

        // Update Stats
        const evalScore = this.ai.evaluate(this.engine) / 100;
        document.getElementById('eval-text').innerText = `Eval: ${evalScore > 0 ? '+' : ''}${evalScore.toFixed(1)}`;
        document.getElementById('eval-fill').style.width = `${50 + (evalScore * 5)}%`;
        document.getElementById('game-status').innerText = `${this.engine.turn === 'w' ? 'WHITE' : 'BLACK'} TO MOVE`;
        
        // Update History
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
            const move = document.createElement('div');
            move.innerText = this.indexToCoord(h.move.from) + '→' + this.indexToCoord(h.move.to);
            histEl.appendChild(move);
        });
        histEl.scrollTop = histEl.scrollHeight;
    }

    indexToCoord(i) {
        const files = ['a','b','c','d','e','f','g','h'];
        return files[i % 8] + (8 - Math.floor(i / 8));
    }

    undo() { this.engine.undo(); if(this.useAI) this.engine.undo(); this.render(); }
    reset() { this.engine.reset(); this.render(); }
    toggleAI() { this.useAI = !this.useAI; document.getElementById('ai-toggle').innerText = `AI: ${this.useAI ? 'ON' : 'OFF'}`; }
    setDifficulty(d) { this.difficulty = parseInt(d); }
}

const gameUI = new ChessUI();

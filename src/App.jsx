import { useEffect, useMemo, useState } from 'react';
import CryptoJS from 'crypto-js';

const ROWS = 15;
const COLS = 15;
const TOTAL_MINES = 40;
const TARGET_RED_COUNTS = [1, 1, 1, 2, 2, 3, 3, 3, 4, 5];
const ENCRYPTED_STRING = '9t7KLNeQOeY9MnkCqhimvR0Y7lJsIxZsw61BptZ6JAKvDOqQcz+ahCO91hvx1qN+';

function getCellKey(row, col) {
  return `${row},${col}`;
}

function createEmptyBoard(redPositions) {
  return Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({
      row,
      col,
      isMine: false,
      adjacentMines: 0,
      revealed: false,
      flagged: false,
      redOutline: redPositions.some(([r, c]) => r === row && c === col),
    }))
  );
}

function getNeighbors(row, col) {
  const list = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        list.push([nr, nc]);
      }
    }
  }
  return list;
}

function computeAdjacentCounts(board) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board[row][col].isMine) {
        board[row][col].adjacentMines = 0;
        continue;
      }
      const neighbors = getNeighbors(row, col);
      board[row][col].adjacentMines = neighbors.reduce(
        (count, [nr, nc]) => count + (board[nr][nc].isMine ? 1 : 0),
        0
      );
    }
  }
}

function canSolveBoard(board) {
  const state = board.map((row) =>
    row.map((cell) => ({
      isMine: cell.isMine,
      adjacentMines: cell.adjacentMines,
      revealed: !cell.isMine,
      flagged: false,
    }))
  );

  let progress = true;
  while (progress) {
    progress = false;

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = state[row][col];
        if (!cell.revealed || cell.isMine) continue;

        const neighbors = getNeighbors(row, col);
        const hidden = neighbors.filter(
          ([nr, nc]) => !state[nr][nc].revealed && !state[nr][nc].flagged
        );
        const flagged = neighbors.filter(([nr, nc]) => state[nr][nc].flagged).length;
        const remaining = cell.adjacentMines - flagged;

        if (remaining === hidden.length && hidden.length > 0) {
          hidden.forEach(([nr, nc]) => {
            state[nr][nc].flagged = true;
          });
          progress = true;
        }
      }
    }
  }

  return board.flat().every((cell, index) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    return state[row][col].flagged === cell.isMine;
  });
}

function chooseRedPositions(countCells) {
  const chosen = [];
  const used = new Set();

  for (const value of TARGET_RED_COUNTS) {
    const options = (countCells.get(value) || []).filter(
      (cell) => !used.has(getCellKey(cell.row, cell.col))
    );
    if (options.length === 0) return null;
    const choice = options[Math.floor(Math.random() * options.length)];
    used.add(getCellKey(choice.row, choice.col));
    chosen.push([choice.row, choice.col]);
  }

  return chosen;
}

function createBoard() {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const board = createEmptyBoard([]);
    const minePositions = new Set();

    while (minePositions.size < TOTAL_MINES) {
      const row = Math.floor(Math.random() * ROWS);
      const col = Math.floor(Math.random() * COLS);
      const key = getCellKey(row, col);
      if (minePositions.has(key)) continue;
      minePositions.add(key);
      board[row][col].isMine = true;
    }

    computeAdjacentCounts(board);

    if (!canSolveBoard(board)) continue;

    const countCells = new Map();
    TARGET_RED_COUNTS.forEach((value) => countCells.set(value, []));

    board.flat().forEach((cell) => {
      if (!cell.isMine && countCells.has(cell.adjacentMines)) {
        countCells.get(cell.adjacentMines).push(cell);
      }
    });

    const redPositions = chooseRedPositions(countCells);
    if (redPositions) {
      redPositions.forEach(([row, col]) => {
        board[row][col].redOutline = true;
      });

      return board;
    }
  }

  const fallback = createEmptyBoard([]);
  const fallbackMines = [
    [0, 0],
    [0, 7],
    [1, 3],
    [2, 6],
    [3, 1],
    [4, 5],
    [5, 2],
    [6, 4],
    [7, 0],
    [7, 7],
  ];

  fallbackMines.forEach(([row, col]) => {
    fallback[row][col].isMine = true;
  });

  computeAdjacentCounts(fallback);

  const fallbackCountCells = new Map();
  TARGET_RED_COUNTS.forEach((value) => fallbackCountCells.set(value, []));
  fallback.flat().forEach((cell) => {
    if (!cell.isMine && fallbackCountCells.has(cell.adjacentMines)) {
      fallbackCountCells.get(cell.adjacentMines).push(cell);
    }
  });

  const fallbackRedPositions = chooseRedPositions(fallbackCountCells);
  if (fallbackRedPositions) {
    fallbackRedPositions.forEach(([row, col]) => {
      fallback[row][col].redOutline = true;
    });
  }

  return fallback;
}

function revealNeighbors(board, row, col) {
  const stack = [[row, col]];
  const visited = new Set();

  while (stack.length > 0) {
    const [currentRow, currentCol] = stack.pop();
    const key = getCellKey(currentRow, currentCol);
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = board[currentRow][currentCol];
    if (cell.revealed || cell.isMine) continue;

    cell.revealed = true;

    if (cell.adjacentMines === 0) {
      getNeighbors(currentRow, currentCol).forEach(([nr, nc]) => {
        const neighbor = board[nr][nc];
        if (!neighbor.isMine && !visited.has(getCellKey(nr, nc))) {
          stack.push([nr, nc]);
        }
      });
    }
  }
}

function decryptMessage(keyString) {
  if (!keyString) return '';
  try {
    const md5Hex = CryptoJS.MD5(keyString).toString(CryptoJS.enc.Hex);
    const key = CryptoJS.enc.Hex.parse(md5Hex);
    const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
    const bytes = CryptoJS.AES.decrypt(ENCRYPTED_STRING, key, { iv });
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return null;
    return decrypted;
  } catch (error) {
    return null;
  }
}

export default function App() {
  const [board, setBoard] = useState(() => createBoard());
  const [lost, setLost] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setBoard(createBoard());
    setLost(false);
    setInputValue('');
  }, [ROWS, COLS]);

  const decrypted = useMemo(() => decryptMessage(inputValue), [inputValue]);

  const handleCellClick = (row, col) => {
    if (lost) return;
    setBoard((currentBoard) => {
      const nextBoard = currentBoard.map((rowData) => rowData.map((cell) => ({ ...cell })));
      const cell = nextBoard[row][col];
      if (cell.revealed || cell.flagged) return currentBoard;
      if (cell.isMine) {
        cell.revealed = true;
        setLost(true);
        return nextBoard;
      }
      if (cell.adjacentMines === 0) {
        revealNeighbors(nextBoard, row, col);
      } else {
        cell.revealed = true;
      }
      return nextBoard;
    });
  };

  const handleRestart = () => {
    setBoard((currentBoard) =>
      currentBoard.map((rowData) =>
        rowData.map((cell) => ({
          ...cell,
          revealed: false,
          flagged: false,
        }))
      )
    );
    setLost(false);
    setInputValue('');
  };

  const handleInputChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, '');
    setInputValue(digitsOnly);
  };

  return (
    <div className="app-shell">
      <h1>Bienvenu :)</h1>
      <div className="game-panel">
        <div
          className="board"
          style={{ gridTemplateColumns: `repeat(${COLS}, var(--cell-size))` }}
        >
          {board.flat().map((cell) => {
            const className = [
              'cell',
              cell.revealed ? 'revealed' : '',
              cell.flagged ? 'flagged' : '',
              cell.isMine && cell.revealed ? 'mine' : '',
              cell.redOutline && cell.revealed ? 'red-outline' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={`${cell.row}-${cell.col}`}
                className={className}
                type="button"
                onClick={() => handleCellClick(cell.row, cell.col)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setBoard((currentBoard) => {
                    const nextBoard = currentBoard.map((rowData) => rowData.map((cell) => ({ ...cell })));
                    const target = nextBoard[cell.row][cell.col];
                    if (target.revealed || lost) return currentBoard;
                    target.flagged = !target.flagged;
                    return nextBoard;
                  });
                }}
              >
                {cell.revealed ? (cell.isMine ? '💣' : cell.adjacentMines || '') : cell.flagged ? '🚩' : ''}
              </button>
            );
          })}
        </div>
        <div className="status-row">
          <button type="button" className="restart-button" onClick={handleRestart}>
            Restart
          </button>
          {lost && <span className="status-message">Perdu :(</span>}
        </div>
      </div>
      <div className="decrypt-panel">
        <input
          id="decrypt-input"
          inputMode="numeric"
          pattern="\d*"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Clé super secrète"
        />
        <div className="decryption-output">
          {inputValue === '' && <span>Ma jolie adresse</span>}
          {inputValue !== '' && decrypted === null && <span>Bien tenté...</span>}
          {inputValue !== '' && decrypted !== null && <span>Omg tu l'as fait!!! {decrypted}</span>}
        </div>
      </div>
    </div>
  );
}

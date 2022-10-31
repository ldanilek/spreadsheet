import { Id, Document } from "./convex/_generated/dataModel";
import { DatabaseReader } from "./convex/_generated/server";

export const rowColKey = (row: number, col: number): string => {
  return `${row},${col}`;
}

const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
export const colDisplay = (col: number): string => {
    return alphabet[col];
};

export type EvalEnv = {
    db: DatabaseReader,
    sheet: Id<'sheets'>, 
};

export const getCell = async (
    env: EvalEnv,
    row: number, 
    col: number,
): Promise<null | Document<'cells'>> => {
    return await env.db
        .query('cells')
        .withIndex('row_col', q => q.eq('sheet', env.sheet).eq('row', row).eq('col', col))
        .first();
};

export const computeResult = async (
    env: EvalEnv,
    row: number, 
    col: number,
): Promise<string> => {
    const cell = await getCell(env, row, col);
    if (!cell) {
        return "";
    }
    const expr = cell.input;
    if (!expr.startsWith('=')) {
        // literal
        return expr;
    }
    try {
        const tokens = tokenize(expr.substring(1));
        printTokens(tokens);
        const tree = parseTree(tokens);
        // console.log(printTree(tree, 0).join('\n'));
        const val = await evalExpr(env, tree);
        return "" + val;
    } catch (e) {
        return `eval error ${e}`;
    }
};

type ParseNode = {
    op: string;
    args: ParseNode[];
    literal?: string;
    cell?: [number, number];
};

const printTokens = (tokens: string[]) => {
    //console.log(tokens.join(', '));
}

const printIndent = (indent: number): string => {
    let s = '';
    for (let i = 0; i < indent; i++) {
        s += '  ';
    }
    return s;
}

const printTree = (
    node: ParseNode,
    indent: number,
): string[] => {
    let s = [];
    s.push(`${printIndent(indent)}${node.op}`);
    for (const arg of node.args) {
        s.push(...printTree(arg, indent+1));
    }
    if (node.cell) {
        s.push(`${printIndent(indent)}Cell ${node.cell[0]}, ${node.cell[1]}`);
    }
    if (node.literal) {
        s.push(`${printIndent(indent)}Literal ${node.literal[0]}`);
    }
    return s;
};

const NUMBER = /^(\d+(\.\d+)?)/;
const CELL_ID = /^([A-Z]\d+)/;
const TOKENS = /^(\+|\-|\*|\/|\(|\)|(sum)|(avg)|(max)|(\d+(\.\d+)?)|([A-Z]\d+)|:|,)/;
const WHITESPACE = /^\s+/;

const tokenize = (expr: string): string[] => {
    if (expr.length === 0) {
        return [];
    }
    const firstToken = expr.match(TOKENS);
    if (firstToken) {
        return [firstToken[0], ...tokenize(expr.substring(firstToken[0].length))];
    }
    const whitespace = expr.match(WHITESPACE);
    if (whitespace) {
        return tokenize(expr.substring(whitespace.length));
    }
    throw new Error(`tokenize error on character "${expr}"`);
};

const cellIdToIndex = (cellId: string): [number, number] => {
    return [
        parseInt(cellId.substring(1)),
        cellId.charCodeAt(0) - 'A'.charCodeAt(0),
    ];
};

const parseTree = (tokens: string[]): ParseNode => {
    const [v, rest] = parseTop(tokens);
    if (rest.length > 0) {
        throw new Error(`parse error near "${rest[0]}"`);
    }
    return v;
}

const parseAtom = (tokens: string[]): [ParseNode, string[]] => {
    if (tokens.length === 0) {
        throw new Error('expected atom');
    }
    if (tokens[0] === '(') {
        const [arg, rest] = parseTop(tokens.slice(1));
        if (rest.length > 0 && rest[0] === ')') {
            return [arg, rest.slice(1)];
        }
        throw new Error('unmatched paren');
    }
    if (tokens[0].match(NUMBER)) {
        return [{
            op: 'number',
            args: [],
            literal: tokens[0],
        }, tokens.slice(1)];
    }
    if (tokens[0].match(CELL_ID)) {
        if (tokens.length === 1 || tokens[1] !== ':') {
            return [{
                op: 'cell',
                args: [],
                cell: cellIdToIndex(tokens[0]),
            }, tokens.slice(1)];
        }
        if (tokens.length > 2 && tokens[1] === ':' && tokens[2].match(CELL_ID)) {
            return [{
                op: 'block',
                args: [{
                    op: 'cell',
                    args: [],
                    cell: cellIdToIndex(tokens[0]),
                }, {
                    op: 'cell',
                    args: [],
                    cell: cellIdToIndex(tokens[2]),
                }],
            }, tokens.slice(3)];
        }
    }
    throw new Error(`invalid atom ${tokens}`);
};

const TOP_OPS = [','];

const parseTop = (tokens: string[]): [ParseNode, string[]] => {
    const [arg1, rest1] = parseAdd(tokens);
    if (rest1.length === 0) {
        return [arg1, rest1];
    }
    if (TOP_OPS.includes(rest1[0])) {
        const [arg2, rest2] = parseAdd(rest1.slice(1));
        return [{
            op: rest1[0],
            args: [arg1, arg2],
        }, rest2];
    }
    return [arg1, rest1];
};

const ADD_OPS = ['+', '-'];

const parseAdd = (tokens: string[]): [ParseNode, string[]] => {
    const [arg1, rest1] = parseMul(tokens);
    if (rest1.length === 0) {
        return [arg1, rest1];
    }
    if (ADD_OPS.includes(rest1[0])) {
        const [arg2, rest2] = parseMul(rest1.slice(1));
        return [{
            op: rest1[0],
            args: [arg1, arg2],
        }, rest2];
    }
    return [arg1, rest1];
};

const MUL_OPS = ['*', '/'];

const parseMul = (tokens: string[]): [ParseNode, string[]] => {
    const [arg1, rest1] = parseUnary(tokens);
    if (rest1.length === 0) {
        return [arg1, rest1];
    }
    if (MUL_OPS.includes(rest1[0])) {
        const [arg2, rest2] = parseUnary(rest1.slice(1));
        return [{
            op: rest1[0],
            args: [arg1, arg2],
        }, rest2];
    }
    return [arg1, rest1];
};

const UNARY_TOKENS = ['-', 'sum', 'avg', 'max'];

const parseUnary = (tokens: string[]): [ParseNode, string[]] => {
    if (tokens.length === 0) {
        throw new Error('expected unary, found empty string');
    }
    if (UNARY_TOKENS.includes(tokens[0])) {
        const [arg, rest] = parseAtom(tokens.slice(1));
        return [{
            op: tokens[0],
            args: [arg],
        }, rest];
    }
    return parseAtom(tokens);
};

const explodeBlock = (
    blockArgs: ParseNode[],
): ParseNode[] => {
    if (blockArgs.length !== 2) {
        throw new Error(`block needs start and end, got ${blockArgs.length}`);
    }
    if (blockArgs[0].op !== 'cell' || blockArgs[1].op !== 'cell') {
        throw new Error('block needs cells');
    }
    const [row0, col0] = blockArgs[0].cell!;
    const [row1, col1] = blockArgs[1].cell!;
    const args: ParseNode[] = [];
    for (let row = row0; row <= row1; row++) {
        for (let col = col0; col <= col1; col++) {
            args.push({
                op: 'cell',
                args: [],
                cell: [row, col],
            });
        }
    }
    return args;
};

const explodeArgs = (
    args: ParseNode[],
): ParseNode[] => {
    const newArgs: ParseNode[] = [];
    for (const arg of args) {
        if (arg.op === 'block') {
            newArgs.push(...explodeBlock(arg.args));
        } else if (arg.op === ',') {
            newArgs.push(...explodeArgs(arg.args));
        } else {
            newArgs.push(arg);
        }
    }
    return newArgs;
};

const evalExpr = async (
    env: EvalEnv,
    tree: ParseNode,
): Promise<number> => {
    const args = await Promise.all(
        explodeArgs(tree.args).map((arg) => evalExpr(env, arg))
    );
    switch (tree.op) {
        case 'sum':
        case '+':
            return args.reduce((a, b) => a + b);
        case '-':
            if (args.length === 1) {
                return -args[0];
            }
            return args.reduce((a, b) => a - b);
        case '*':
            return args.reduce((a, b) => a * b);
        case '/':
            return args.reduce((a, b) => a / b);
        case 'max':
            return args.reduce((a, b) => Math.max(a, b));
        case 'avg':
            return args.reduce((a, b) => a + b) / args.length;
        case 'number':
            return parseFloat(tree.literal!);
        case 'cell':
            const [row, col] = tree.cell!;
            const result = await computeResult(env, row, col);
            return parseFloat(result);
    }
    throw new Error(`unsupported op ${tree.op}`);
}

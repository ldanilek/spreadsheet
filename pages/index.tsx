import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import { useQuery, useMutation } from '../convex/_generated/react'
import { useCallback, useState } from 'react'
import { colDisplay, rowColKey } from '../common'


const Cell = ({row, col}: {row: number, col: number}) => {
  const cell = useQuery('getCell', row, col);
  const setCellInput = useMutation('setCellInput');
  const [editing, setEditing] = useState(false);
  const [editInput, setEditInput] = useState('');

  const done = async () => {
    await setCellInput(row, col, editInput);
    setEditInput('');
    setEditing(false);
  };

  const edit = () => {
    setEditing(true);
    setEditInput(cell ? cell.input : "");
  }

  if (editing) {
    return (<span>
      <input type="text" value={editInput} onChange={(e) => setEditInput(e.target.value)} />
      <button className={styles.cellButton} onClick={() => done()}>done</button>
    </span>);
  } else {
    let editButton = <button className={styles.cellButton} onClick={() => edit()}>edit</button>;
    if (!cell) {
      return <span>{editButton}</span>;
    }
    return <span>{cell.result} {editButton}</span>;
  }
};

const Spreadsheet = () => {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const cols = [0, 1, 2, 3, 4, 5];
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          {cols.map((col) => <th key={col}>{colDisplay(col)}</th>)}
        </tr>
      </thead>
      <tbody>
      {
        rows.map((row) => <tr key={row}>
          <td>{row}</td>
          {cols.map((col) => <td className={styles.cell} key={rowColKey(row, col)}><Cell row={row} col={col}/></td>)}
        </tr>)
      }
      </tbody>
    </table>

  );
};

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Convex Spreadsheet</title>
        <meta name="description" content="Spreadsheet built on Convex" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <Spreadsheet />
        <p>Each cell subscribes to exactly the cells it depends on (recursively) to minimize computation.</p>
        <p>Sample expressions
        <ul>
          <li>30</li>
          <li>=(5+3)/4</li>
          <li>=A1 * 2</li>
          <li>=avg(A0:A5)</li>
        </ul>
        </p>
        <p>Note computed expressions (starting with "=") must evaluate to a number and dependency cycles aren't supported</p>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://www.convex.dev/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/convex.svg" alt="Convex Logo" width={90} height={18} />
          </span>
        </a>
      </footer>
    </div>
  )
}

export default Home

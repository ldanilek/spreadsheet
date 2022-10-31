import { Document } from './_generated/dataModel'
import { query } from './_generated/server'
import { getCell, computeResult } from '../common'

export default query(async ({ db }, row: number, col: number): Promise<null | Document<'cells'>> => {
  const sheet = await db.query('sheets').unique();
  const cellDoc = await getCell({db, sheet: sheet._id}, row, col);
  if (!cellDoc) {
    return null;
  }

  const result = await computeResult({db, sheet: sheet._id}, row, col);
  return {...cellDoc, result};
})

import { getCell } from '../common';
import { mutation } from './_generated/server'

export default mutation(
  async ({ db }, row: number, col: number, input: string) => {
    const sheet = await db.query('sheets').unique();
    const cellDoc = await getCell({db, sheet: sheet._id}, row, col);

    if (cellDoc === null) {
      await db.insert('cells', {
        sheet: sheet._id,
        row,
        col,
        input,
        result: "",
      });
    } else {
      await db.patch(cellDoc._id, {input});
    }
  })

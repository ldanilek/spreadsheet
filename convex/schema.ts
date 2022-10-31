import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  cells: defineTable({
    sheet: s.id('sheets'),
    row: s.number(),
    col: s.number(),
    input: s.string(),
    result: s.string(),
  })
  .index('row_col', ['sheet', 'row', 'col'])
  .index('col_row', ['sheet', 'col', 'row']),
  sheets: defineTable({
    name: s.string(),
  }),
});

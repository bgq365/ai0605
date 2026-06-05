import path from "node:path";

const root = process.cwd();

export const fixtureFiles = {
  haikouExcel: path.join(root, "AI考试附件", "demos", "12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx"),
  hunanExcel: path.join(root, "AI考试附件", "demos", "湖南仓.xlsx"),
  multiSheetExcel: path.join(root, "AI考试附件", "demos", "多门店分Sheet出库单.xlsx"),
  cardExcel: path.join(root, "AI考试附件", "demos", "门店调拨单-卡片式.xlsx"),
  pdfDelivery: path.join(root, "AI考试附件", "demos", "黔寨寨贵州烙锅（鞍山店）常温.pdf"),
};

import type { ImportRule } from "@/lib/domain/types";

const timestamp = "2026-06-05T00:00:00.000Z";

export const sampleRules: ImportRule[] = [
  {
    id: "haikou-footer-excel",
    name: "海口配送发货单",
    description: "主表明细 + 尾部收货信息提取",
    documentKind: "excel",
    createdAt: timestamp,
    updatedAt: timestamp,
    definition: {
      source: { mode: "excelSheets" },
      segment: { mode: "wholeSheet" },
      table: {
        headerRow: 4,
        dataStartRow: 5,
        dataEndRow: 7,
        skipRowsContaining: ["合计"],
        footerRowStart: 8,
        footerExtractors: [
          { label: "单据号", targetField: "externalCode", strategy: "adjacentCell" },
          { label: "收货机构", targetField: "storeName", strategy: "adjacentCell" },
          { label: "收货人", targetField: "recipientName", strategy: "adjacentCell" },
          { label: "收货电话", targetField: "recipientPhone", strategy: "adjacentCell" },
          { label: "收货地址", targetField: "recipientAddress", strategy: "adjacentCell" },
        ],
        columnMap: {
          skuCode: "物品编码",
          skuName: "物品名称",
          skuSpec: "规格型号",
          quantity: "发货数量",
        },
      },
      transforms: [
        { type: "readTabularRows" },
        { type: "ignoreSummaryRows" },
        { type: "extractFooterKeyValues" },
      ],
      output: {
        fields: {
          externalCode: "externalCode",
          storeName: "storeName",
          recipientName: "recipientName",
          recipientPhone: "recipientPhone",
          recipientAddress: "recipientAddress",
        },
        itemFields: {
          skuCode: "skuCode",
          skuName: "skuName",
          skuSpec: "skuSpec",
          quantity: "quantity",
        },
      },
    },
  },
  {
    id: "hunan-grouped-excel",
    name: "湖南仓发货明细",
    description: "按配送单号聚合多 SKU",
    documentKind: "excel",
    createdAt: timestamp,
    updatedAt: timestamp,
    definition: {
      source: { mode: "excelSheets" },
      segment: { mode: "wholeSheet" },
      table: {
        headerRow: 2,
        dataStartRow: 3,
        columnMap: {
          groupCode: "配送单号",
          externalCode: "配送汇总单号*",
          storeName: "收货机构",
          recipientName: "收货人",
          recipientPhone: "收货电话",
          recipientAddress: "收货地址",
          skuCode: "物品编码*",
          skuName: "物品名称",
          skuSpec: "规格型号",
          quantity: "发货数量*",
          remark: "单据备注",
        },
      },
      transforms: [{ type: "readTabularRows" }, { type: "groupRowsByField", options: { field: "groupCode" } }],
      output: {
        groupingField: "groupCode",
        fields: {
          externalCode: "externalCode",
          storeName: "storeName",
          recipientName: "recipientName",
          recipientPhone: "recipientPhone",
          recipientAddress: "recipientAddress",
          remark: "remark",
        },
        itemFields: {
          skuCode: "skuCode",
          skuName: "skuName",
          skuSpec: "skuSpec",
          quantity: "quantity",
        },
      },
    },
  },
  {
    id: "multi-sheet-footer-excel",
    name: "多门店分 Sheet 出库单",
    description: "多 Sheet 合并 + 尾部收货信息提取",
    documentKind: "excel",
    createdAt: timestamp,
    updatedAt: timestamp,
    definition: {
      source: { mode: "excelSheets" },
      segment: { mode: "perSheet" },
      table: {
        headerRow: 4,
        dataStartRow: 5,
        dataEndRow: 12,
        skipRowsContaining: ["合计"],
        footerRowStart: 14,
        footerExtractors: [
          { label: "收货门店：", targetField: "storeName", strategy: "adjacentCell" },
          { label: "联系人：", targetField: "recipientName", strategy: "adjacentCell" },
          { label: "联系电话：", targetField: "recipientPhone", strategy: "adjacentCell" },
          { label: "收货地址：", targetField: "recipientAddress", strategy: "adjacentCell" },
        ],
        columnMap: {
          skuCode: "物品编码",
          skuName: "物品名称",
          skuSpec: "规格型号",
          quantity: "出库数量",
        },
      },
      transforms: [
        { type: "iterateSheets" },
        { type: "readTabularRows" },
        { type: "ignoreSummaryRows" },
        { type: "extractFooterKeyValues" },
      ],
      output: {
        fields: {
          storeName: "storeName",
          recipientName: "recipientName",
          recipientPhone: "recipientPhone",
          recipientAddress: "recipientAddress",
        },
        itemFields: {
          skuCode: "skuCode",
          skuName: "skuName",
          skuSpec: "skuSpec",
          quantity: "quantity",
        },
      },
    },
  },
  {
    id: "card-transfer-excel",
    name: "门店调拨卡片单",
    description: "按卡片标记切分，每张卡片独立成单",
    documentKind: "excel",
    createdAt: timestamp,
    updatedAt: timestamp,
    definition: {
      source: { mode: "excelSheets" },
      segment: { mode: "cardBlocks", marker: "▶ 调拨记录" },
      table: {
        columnMap: {
          skuCode: "物品编码",
          skuName: "物品名称",
          skuSpec: "规格",
          quantity: "数量",
        },
      },
      transforms: [{ type: "segmentCardsByMarker" }, { type: "readTabularRows" }],
      output: {
        fields: {
          storeName: "storeName",
          recipientName: "recipientName",
          recipientPhone: "recipientPhone",
          recipientAddress: "recipientAddress",
        },
        itemFields: {
          skuCode: "skuCode",
          skuName: "skuName",
          skuSpec: "skuSpec",
          quantity: "quantity",
        },
      },
    },
  },
  {
    id: "matrix-store-excel",
    name: "欢乐牧场矩阵配货单",
    description: "按门店列透视矩阵数量并聚合成运单",
    documentKind: "excel",
    createdAt: timestamp,
    updatedAt: timestamp,
    definition: {
      source: { mode: "excelSheets" },
      segment: { mode: "wholeSheet" },
      table: {
        headerRow: 1,
        dataStartRow: 2,
        columnMap: {
          warehouseName: "仓库名称",
          ownerName: "货主名称",
          skuName: "SKU名称",
          skuCode: "SKU条码",
          externalSkuCode: "外部商品编码",
          skuSpec: "规格",
        },
      },
      transforms: [
        {
          type: "pivotMatrixColumns",
          options: {
            storeColumns: ["银泰", "金银潭", "金桥", "门店B", "门店D"],
            quantityField: "quantity",
            storeField: "storeName",
          },
        },
      ],
      output: {
        groupingField: "storeName",
        fields: {
          externalCode: "externalCode",
          storeName: "storeName",
          recipientName: "recipientName",
          recipientPhone: "recipientPhone",
          recipientAddress: "recipientAddress",
          remark: "remark",
        },
        itemFields: {
          skuCode: "skuCode",
          skuName: "skuName",
          skuSpec: "skuSpec",
          quantity: "quantity",
        },
      },
    },
  },
  {
    id: "pdf-delivery-text",
    name: "PDF 配送单",
    description: "PDF 明细提取 + 收货区识别",
    documentKind: "pdf",
    createdAt: timestamp,
    updatedAt: timestamp,
    definition: {
      source: { mode: "pdfPages" },
      segment: { mode: "pdfSingle" },
      table: {},
      transforms: [
        {
          type: "extractTextByRegex",
          options: {
            itemPattern:
              "^(\\d+)\\s+(.+?)\\s+(ZBWP\\d+)\\s+(.+?)\\s+([^\\s]+)\\s+(件|包|瓶|盒|袋|kg|KG)\\s+(\\d+)$",
            recipientPattern: "收货人[：:]\\s*(.+?)\\s*收货电话",
            phonePattern: "收货电话[：:]\\s*(\\d{11})",
            addressPattern: "收货地址[：:]\\s*(.+)$",
            externalCodePattern: "单据编号[：:]\\s*([^\\s]+)",
            storeNamePattern: "收货机构[：:]\\s*([^\\n]+)",
          },
        },
      ],
      output: {
        fields: {
          externalCode: "externalCode",
          storeName: "storeName",
          recipientName: "recipientName",
          recipientPhone: "recipientPhone",
          recipientAddress: "recipientAddress",
        },
        itemFields: {
          skuCode: "skuCode",
          skuName: "skuName",
          skuSpec: "skuSpec",
          quantity: "quantity",
        },
      },
    },
  },
];

import { bitable } from '@lark-base-open/js-sdk';

/**
 * 分批并发获取记录
 * @param recordIds 记录ID数组
 * @param batchSize 每批处理的数量，默认为 50
 * @returns 记录数组
 */

export async function getRecordsByIdsBatch(tableId, recordIds, batchSize = 50) {
  const table = await bitable.base.getTableById(tableId);
  const allRecords = [];
  
  // 分批处理
  for (let i = 0; i < recordIds.length; i += batchSize) {
    const batch = recordIds.slice(i, i + batchSize);
    
    const records = await Promise.all(
      batch.map(async (recordId) => {
        try {
          const record = await table.getRecordById(recordId);
          return {
            recordId,
            ...record
          };
        } catch (error) {
          console.error(`获取记录 ${recordId} 失败:`, error);
          return null;
        }
      })
    );
    
    allRecords.push(...records.filter(r => r !== null));
    
    // 可选：在批次之间添加延迟，避免请求过于集中
    if (i + batchSize < recordIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return allRecords;
}

export function getTextFromFieldData(fieldData) {
  let text = '';
  if (Array.isArray(fieldData)) {
    fieldData.forEach((x) => {
      text += x.text;                  
    });
  } else if (fieldData && typeof fieldData === 'object') {
    if (typeof fieldData.text != 'undefined') {
      text = fieldData.text;
    } else {
      console.error('fieldData err: ', fieldData);
    }
  }
  return text;
}

// 获取当前表格数据
export async function getThisTableData(tableId,countLimit = null) {
  const table = await bitable.base.getTableById(tableId);
  await bitable.ui.switchToTable(tableId);
  const selection = await bitable.base.getSelection();

  const view = await table.getViewById(selection.viewId);
  const recordList = await view.getVisibleRecordIdList();
  if(countLimit){
    return recordList.slice(0, countLimit);
  }
  else{
    return recordList;
  }
};

// 获取当前表格选中的数据
export async function getSelectedTableData (tableId) {
  const table = await bitable.base.getTableById(tableId);
  const selection = await bitable.base.getSelection();

  const view = await table.getViewById(selection.viewId);
  const selectIds = await view.getSelectedRecordIdList()
  return selectIds;
};
// 查询表格字段名
export async function queryTableFields(table) {      

  // 获取所有字段的元信息
  const fieldMetaList = await table.getFieldMetaList();

  const fields = {};
  for (const fieldMeta of fieldMetaList) {
    fields[fieldMeta.id] = fieldMeta.name;
  }
  // const arr = Object.values(fields);
  
  return fields
}
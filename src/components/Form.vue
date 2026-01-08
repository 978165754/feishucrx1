<script>
  import { bitable } from '@lark-base-open/js-sdk';
  import { ref, onMounted } from 'vue';
  import {
    ElButton,
    ElForm,
    ElFormItem,
    ElSelect,
    ElOption,
    ElRadio,
    ElRadioButton,
    ElRadioGroup,
    ElMessage
  } from 'element-plus';

  export default {
    components: {
      ElButton,
      ElForm,
      ElFormItem,
      ElSelect,
      ElOption,
      ElRadio,
      ElRadioButton,
      ElRadioGroup,
    },
    setup() {
      const formDataOrigin = {
        table1: '',
        dataOption: 'all',
        joinStr:'：',
        count:100,
        table2: '',
        fields : [],
        targetFields: ''
      };
      const formData = ref({ ...formDataOrigin }); // 添加dataOption，默认为all（全部数据）
      const tableMetaList = ref([]);
      const table1Fields = ref([]);
      const table2Fields = ref([]);

      const getDataCount = ref(5000);

      // 获取当前表格数据
      const getThisTableData = async (tableId,countLimit = null) => {
        const table = await bitable.base.getTableById(tableId);
        await bitable.ui.switchToTable(tableId);
        const viewMetaList = await table.getViewMetaList();
        
        
        const view = await table.getViewById(viewMetaList[0].id);
        const recordList = await view.getVisibleRecordIdList();
        if(countLimit){
          return recordList.slice(0, countLimit);
        }
        else{
          return recordList;
        }
      };
      // 获取当前表格选中的数据
      const getSelectedTableData = async (tableId) => {
       const table = await bitable.base.getTableById(tableId);
        const viewMetaList = await table.getViewMetaList();

        const view = await table.getViewById(viewMetaList[0].id);
        const selectIds = await view.getSelectedRecordIdList()
        return selectIds;
      };
      // 查询表格字段名
      async function queryTableFields(table) {      
        

        // 获取所有字段的元信息
        const fieldMetaList = await table.getFieldMetaList();

        const fields = {};
        for (const fieldMeta of fieldMetaList) {
          fields[fieldMeta.id] = fieldMeta.name;
        }
        // const arr = Object.values(fields);
        
        return fields
      }
      // 切换数据表
      async function changeTable2(tableId) { 
        const table = await bitable.base.getTableById(tableId);
        queryTableFields(table).then(fields => {
          table2Fields.value = fields;
        }).catch(error => {
          console.error('Error querying table fields:', error);
          ElMessage.error('获取表格字段失败: ' + error.message);
        });
      }

      /**
       * 分批并发获取记录
       * @param recordIds 记录ID数组
       * @param batchSize 每批处理的数量，默认为 50
       * @returns 记录数组
       */
      async function getRecordsByIdsBatch(
        recordIds, 
        batchSize = 50
      ) {
        const table = await bitable.base.getActiveTable();
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

      const addDatasRecord = async () => {
        const {fields,table2,dataOption,targetFields} = formData.value;
          if(fields.length === 0){
            ElMessage.error('请先选择要获取数据的字段');
            return;
          }          
          if (!table2) {
            ElMessage.error('请先选择目标数据表B');
            return;
          }
          if (!targetFields) {
            ElMessage.error('请先选择目标字段');
            return;
          }

          localStorage.setItem('formData', JSON.stringify(formData.value));
          
          // console.log(fields,dataOption);
          let recordsIds = [];
          // 1. 获取表格A的数据id集合
          if(dataOption === 'all'){
            recordsIds = await getThisTableData(formData.value.table1);
          }
          else if(dataOption === 'counts'){
            recordsIds = await getThisTableData(formData.value.table1, formData.value.count);
          }
          else{
            recordsIds = await getSelectedTableData(formData.value.table1);
            if(recordsIds.length === 0){
              ElMessage.error('当前未选中任何数据，请先选择要合并的数据');
              return;
            }
          }
          const allrecords = await getRecordsByIdsBatch(recordsIds);
          // console.log('records: ', allrecords);
          // 2.获取id对应的数据
          let str = formData.value.joinStr || '：';
          const records = allrecords.map(record => {
            const newRecord = [];
            for (const fieldId of fields) {
              let fieldData = record.fields[fieldId];
              if(!fieldData){
                continue;
              }
              let text = ''
              if(Array.isArray(fieldData)){
                fieldData.forEach((x) => {
                  text += x.text;                  
                });
              }
              else if(typeof fieldData === 'object'){
                if(typeof fieldData.text != 'undefined'){
                  text = fieldData.text;
                }
                else{
                  console.error('fieldData err: ', fieldData);
                }
              }
              newRecord.push(text);
            }
            return newRecord.join(str);
          });
          // console.log(records);
          
          

          try {
            const toTable = await bitable.base.getTableById(table2);
            const toField = await toTable.getField(targetFields);

            // 准备要插入的数据
            const dataToInsert = records.join('\n');

            // 创建要插入的记录数组
            const recordsToInsert = [];
            
            const videoCell = await toField.createCell(dataToInsert);           
            recordsToInsert.push([videoCell]);

            // 批量插入记录
            const recordIds = await toTable.addRecords(recordsToInsert);
            // console.log('批量插入成功，记录ID:', recordIds);
            ElMessage.success(`成功合并 ${records.length} 条记录`);
            
          } catch (error) {
            // console.error('批量插入失败:', error);
            ElMessage.error('写入失败: ' + error.message);
          }
      };

      const changeTable1 = async (tableId) => { 
        getTableFields(tableId);
        formData.value.fields = [];
      };

      // 获取表格字段名
      const getTableFields = async (tableId) => { 
        const table = await bitable.base.getTableById(tableId);
        queryTableFields(table).then(fields => {
          table1Fields.value = fields;
        }).catch(error => {
          console.error('Error querying table fields:', error);
          ElMessage.error('获取表格字段失败: ' + error.message);
        });
      };

      onMounted(async () => {
        const [tableList, selection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
          const savedFormData = localStorage.getItem('formData');
          if (savedFormData) {
            formData.value = JSON.parse(savedFormData);
            changeTable2(formData.value.table2);
          }
          else{
            formData.value.table1 = selection.tableId;
          }
          getTableFields(formData.value.table1);

          tableMetaList.value = tableList;
      });

      const resetFormdata = async  () => {
        const  selection  = await bitable.base.getSelection();
        formData.value = { ...formDataOrigin,table1: selection.tableId };
        getTableFields(formData.value.table1);
       
      };

      return {
        resetFormdata,
        formData,
        tableMetaList,
        addDatasRecord,
        table1Fields,
        table2Fields,
        changeTable2,
        changeTable1
      };
    },
  };
</script>

<template>
  <el-form ref="form" class="form" :model="formData" label-position="top">
    <div class="merge-info">
      将表格A内 <b>选中的数据</b> 或 <b>全部数据(最多5000条)</b> 合并到 <b>目标表格B</b>
      <br>
      <el-link href="https://ai.feishu.cn/wiki/B7LTwox5bisZnvkEyIxcoM3Sncc" target="_blank">📝如有问题和新需求，点此处反馈</el-link>
    </div>

    <el-card class="form-card" shadow="never">
      <el-form-item label="1.选择原始“数据表”（A）" size="large">
        <el-select v-model="formData.table1" placeholder="请选择数据表A" style="width: 100%" @change="changeTable1">
          <el-option
            v-for="meta in tableMetaList"
            :key="meta.id"
            :label="'📊'+meta.name"
            :value="meta.id"
          />
        </el-select>       
      </el-form-item>
      <el-form-item label="2.选择要获取数据的“字段”（列）" size="large">
        <!-- 这里是个多选项 -->
        <el-select v-model="formData.fields" multiple placeholder="请选择字段" style="width: 100%">
          <el-option
            v-for="(field, index) in table1Fields"
            :key="index"
            :label="field"
            :value="index"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="请输入字段间连接符，例如 ：，" size="small"  class="horizontal-item">
        <el-input v-model="formData.joinStr" placeholder="：" style="width: 80px;" ></el-input>
      </el-form-item>
      <el-form-item label="3.选择要合并的数据范围" size="large" style="margin-bottom: 0;">
        <!-- 选条数 -->
        <el-radio-group v-model="formData.dataOption">
          <el-radio value="all">全部数据</el-radio>
          <el-radio value="counts">前几条数据</el-radio>
          <el-radio value="selected">选中数据</el-radio>
        </el-radio-group>
        
        <!-- 当选择"前几条数据"时显示数量输入框 -->
        <el-input 
          v-if="formData.dataOption === 'counts'" 
          v-model.number="formData.count" 
          type="number" 
          :min="1"
          placeholder="请输入前多少条数据，例如：100" 
          style="margin-top: 10px; width: 80%;" 
        />
      </el-form-item>
    </el-card>
    
    <el-card class="form-card" shadow="never">
      <el-form-item label="4.选择要合并到的“数据表”（B）" size="large">
        <el-select v-model="formData.table2" placeholder="请选择数据表B" style="width: 100%" @change="changeTable2">
          <el-option
            v-for="meta in tableMetaList"
            :key="meta.id"
            :label="'📊'+meta.name"
            :value="meta.id"
          />
        </el-select>       
      </el-form-item>
      <el-form-item label="5.选择要合并到的“字段”（列）" size="large">
        <el-select v-model="formData.targetFields" placeholder="请选择目标字段" style="width: 100%">
          <el-option
            v-for="field in table2Fields"
            :key="field"
            :label="field"
            :value="field"
          />
        </el-select>
      </el-form-item>
    
      <el-button type="primary" plain size="large" @click="addDatasRecord">开始合并</el-button>
      <el-button type="info" plain size="large" @click="resetFormdata">清空重填</el-button>
    </el-card>
  </el-form>
</template>

<style scoped>
  
.form {
  padding: 10px 5px;
}

.merge-info {
  line-height: 1.5;
  margin-bottom: 20px;
  background-color: #f5f5f5;
  padding: 5px 10px;
  border-radius: 5px;
}
.merge-info b{
  color:var(--el-color-primary)
}

.form-card {
  margin-bottom: 20px;
  border: 1px solid #ebeef5;
}

/* 单独设置水平布局 */
:deep(.horizontal-item) {
  display: flex;
  align-items: center;
  gap: 10px;
}
:deep(.horizontal-item) .el-form-item__label {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 0 !important;
  margin-bottom: 0 !important;
}

:deep(.horizontal-item) .el-form-item__content {
  margin-left: 0 !important;
}
</style>

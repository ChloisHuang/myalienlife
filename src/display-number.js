const numberFormat=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2,useGrouping:false});
export const displayNumber=value=>numberFormat.format(value);

import {skillProgress} from './characters.js';

export const ACTION_REQUIREMENTS={
 buildUfo1:{career:'scientist',careerLevel:1,science:2},
 buildUfo2:{career:'scientist',careerLevel:2,science:4},
 buildUfo3:{career:'scientist',careerLevel:3,science:6},
 prepareRations:{career:'chef',careerLevel:1,cooking:2},
 spaceResearch:{career:'scientist',careerLevel:2,science:4},
 restoreMemory:{career:'scientist',careerLevel:1,science:3},
 decodeRelic:{science:2},
 decodeTogether:{career:'scientist',careerLevel:1,science:2}
};
export function actionAccessError(g,person,type){
 const rule=ACTION_REQUIREMENTS[type];if(!rule)return null;
 const career=person.id==='player'?g.career:person.position.career;
 if(rule.career&&(career?.id!==rule.career||career.level<rule.careerLevel))return `需要${rule.career==='chef'?'星云膳造':'量子科学'}职业 ${rule.careerLevel} 阶。`;
 const skill=rule.cooking?'cooking':'science',required=rule[skill],level=skillProgress(person.skills[skill]).level;
 if(level<required)return `需要${skill==='cooking'?'烹饪':'科学'}技能 ${required} 级（当前 ${level} 级）。`;
 return null;
}
export function spaceResearchYield(career,skills){return 4+Math.max(0,career.level-1)+Math.max(0,skillProgress(skills.science).level-4);}

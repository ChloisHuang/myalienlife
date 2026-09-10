import {DEFAULT_LIFE_STAGES,skillProgress} from './characters.js';

export const ACTION_REQUIREMENTS={
 developBlueprint:{career:'architect',careerLevel:1},
 constructIsland:{career:'architect',careerLevel:1},
 extractMaterials:{career:'botanist',careerLevel:1},
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
 const adultStart=g.config?.lifeStages?.teenEnd??DEFAULT_LIFE_STAGES.teenEnd;
 if(rule.career&&person.position.age<adultStart)return '成年后才能从事职业。';
 if(rule.career&&(career?.id!==rule.career||career.level<rule.careerLevel))return `需要${{chef:'星云膳造',scientist:'量子科学',architect:'星穹营造',botanist:'异星植物'}[rule.career]}职业 ${rule.careerLevel} 阶。`;
 if(!rule.cooking&&!rule.science)return null;
 const skill=rule.cooking?'cooking':'science',required=rule[skill],level=skillProgress(person.skills[skill]).level;
 if(level<required)return `需要${skill==='cooking'?'烹饪':'科学'}技能 ${required} 级（当前 ${level} 级）。`;
 return null;
}
export function spaceResearchYield(career,skills){return 4+Math.max(0,career.level-1)+Math.max(0,skillProgress(skills.science).level-4);}

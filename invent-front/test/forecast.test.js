import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupForecast} from '../src/lib/forecast.js';
test('category forecast uses unrounded consumption and does not multiply a shared minimum',()=>{
 const result=groupForecast([{id:1,categoria:'TAG',uso_30_dias:1,quantidade_matriz:1},{id:2,categoria:'TAG',uso_30_dias:1,quantidade_matriz:1}], [{id:1,estoque_minimo:10},{id:2,estoque_minimo:10}]);
 assert.equal(result[0].ponto_pedido,10);assert.equal(result[0].sugerido,8);assert.equal(result[0].cmd,'0.07');
});
test('purchase suggestions are integers and enough stock never produces negative quantities',()=>{
 const result=groupForecast([{id:1,categoria:'RASTREADOR',uso_30_dias:7,quantidade_matriz:0},{id:2,categoria:'TAG',uso_30_dias:1,quantidade_matriz:20}], []);
 assert.equal(result[0].sugerido,13);assert.equal(result[0].ponto_pedido,6);assert.equal(result[1].sugerido,0);
});

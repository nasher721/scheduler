/**
 * Simple import test for AI services
 */

console.log('Testing AI services imports...');

try {
  console.log('1. Importing base agent...');
  const { Agent } = await import('./agents/base.js');
  console.log('   ✓ Agent imported');
  
  console.log('2. Importing scheduling agents...');
  const schedulingAgents = await import('./agents/scheduling-agents.js');
  console.log('   ✓ Scheduling agents imported:', Object.keys(schedulingAgents));
  
  console.log('3. Importing orchestrator...');
  const { getSchedulingOrchestrator } = await import('./agents/scheduling-orchestrator.js');
  console.log('   ✓ Orchestrator imported');
  
  console.log('4. Importing AI services...');
  const aiServices = await import('./ai-services/index.js');
  console.log('   ✓ AI services imported:', Object.keys(aiServices));
  
  console.log('5. Importing shared memory...');
  const { getSharedMemoryService } = await import('./shared-memory-service.js');
  console.log('   ✓ Shared memory imported');
  
  console.log('6. Testing service initialization...');
  const services = await aiServices.initializeAIServices({ startAnomalyDetection: false });
  console.log('   ✓ Services initialized:', Object.keys(services));
  
  console.log('7. Testing individual services...');
  console.log('   - Orchestrator:', services.orchestrator ? 'OK' : 'FAIL');
  console.log('   - Demand Forecast:', services.demandForecast ? 'OK' : 'FAIL');
  console.log('   - NLP Assistant:', services.nlpAssistant ? 'OK' : 'FAIL');
  console.log('   - Preference Learning:', services.preferenceLearning ? 'OK' : 'FAIL');
  console.log('   - Anomaly Detection:', services.anomalyDetection ? 'OK' : 'FAIL');
  
  console.log('8. Testing forecast generation...');
  const forecast = await services.demandForecast.generateForecast('2024-03-15', 3);
  console.log('   ✓ Forecast generated:', forecast.length, 'days');
  
  console.log('9. Testing NLP assistant...');
  const nlpResult = await services.nlpAssistant.findAvailableProviders(
    '2024-03-15',
    'DAY',
    [],
    { providers: [], slots: [] }
  );
  console.log('   ✓ NLP assistant working');
  
  console.log('10. Testing status check...');
  const status = await aiServices.getAIServicesStatus();
  console.log('   ✓ Status:', JSON.stringify(status, null, 2));
  
  console.log('\n✅ All imports and basic tests passed!');
  
} catch (error) {
  console.error('\n❌ Import test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

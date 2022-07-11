// @test:import
import
 {}
from
 'lodash';

// @test:export
export {} from 'lodash';

// @test:require
require('lodash');

// @test:inside-block-require
if(true){
  require('lodash');
}

// @test:not-hover-tip
'lodash';
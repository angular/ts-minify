# ng-ts (Work in Progress)

A TypeScript to TypeScript transpiler for property renaming based on type information. 


#### Plan of Attack
- Just try renaming things without keeping track of what it belongs to.
- Ignore things like document.getElementByID (things that cannot be renamed)
- Never want to construct the entire string
- Do we care about types? Care more about the symbol. 
- checkForErrors in main.ts of ts2dart
- check if input is valid, throw error otherwise.
- get the stupid renaming going --> get more clever renaming going

#### License
```
Copyright [2015]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
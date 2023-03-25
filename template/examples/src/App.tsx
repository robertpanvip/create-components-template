`import * as React from "react";
import ${isHook ? hookName : componentName} from "../../src"

export default function App() {
    ${isHook ? `const result = ${hookName}()` : ``}   
    return (
        <div>
        ${isHook ? "" : `<${componentName}/>`}   
        </div>
    )
}`
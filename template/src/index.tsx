`
${isHook ? `
import * as React from "react"

interface ${hookNameFirstUpperCase}Config {
}

const ${hookName} = (props:${hookNameFirstUpperCase}Config) => {
    return (<></>)
}
export default ${hookName}` : `import * as React from "react"

interface ${componentName}Props {
}

const ${componentName}: React.FC<${componentName}Props> = (props) => {
    return (<div>React + vite + Ts</div>)
}
export default ${componentName}`
}
`
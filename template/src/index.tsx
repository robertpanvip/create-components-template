`${isHook ? `import * as React from "react"

export interface ${hookNameFirstUpperCase}Config {
    test?:number
}

const ${hookName} = (config:${hookNameFirstUpperCase}Config) => {
    return (<></>)
}
export default ${hookName}` : `import * as React from "react"
export interface ${componentName}Props {
    test?:number
}
const ${componentName}: React.FC<${componentName}Props> = (props) => {
    console.log(props.test)
    return (<div>React + vite + Ts</div>)
}
export default ${componentName}`
}
`
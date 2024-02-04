`${isHook ? `import * as React from "react"

export interface ${hookNameFirstUpperCase}Config {
    test?:number
}

const ${hookName} = (props:${hookNameFirstUpperCase}Config) => {
    return (<></>)
}
export default ${hookName}` : `import * as React from "react"
interface ${componentName}Props {
    test?:number
}
const ${componentName}: React.FC<${componentName}Props> = (props) => {
    console.log(props.test)
    return (<div>React + vite + Ts</div>)
}
export default ${componentName}`
}
`
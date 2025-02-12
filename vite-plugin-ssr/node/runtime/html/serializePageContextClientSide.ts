export { serializePageContextClientSide }

import { stringify } from '@brillout/json-serializer/stringify'
import { assert, assertWarning, hasProp, isPlainObject, unique } from '../utils'
import type { PageConfig } from '../../../shared/page-configs/PageConfig'
import { isErrorPage } from '../../../shared/error-page'
import { addIs404ToPageProps } from '../../../shared/addIs404ToPageProps'
import pc from '@brillout/picocolors'
import { notSerializable } from '../../../shared/notSerializable'

type PageContextUser = Record<string, unknown>
type PageContextClient = { _pageId: string } & Record<string, unknown>

const passToClientBuiltIn: string[] = ['abortReason', '_urlRewrite']
const passToClientBuiltInError = ['pageProps', 'is404', '_isError']

function serializePageContextClientSide(pageContext: {
  _pageId: string
  _passToClient: string[]
  _pageConfigs: PageConfig[]
  is404: null | boolean
  pageProps?: Record<string, unknown>
  _isError?: true
}) {
  const pageContextClient: PageContextClient = { _pageId: pageContext._pageId }

  let passToClient = [...pageContext._passToClient, ...passToClientBuiltIn]

  if (isErrorPage(pageContext._pageId, pageContext._pageConfigs)) {
    assert(hasProp(pageContext, 'is404', 'boolean'))
    addIs404ToPageProps(pageContext)
    passToClient.push(...passToClientBuiltInError)
  }

  passToClient = unique(passToClient)

  passToClient.forEach((prop) => {
    // We set non-existing props to `undefined`, in order to pass the list of passToClient values to the client-side
    pageContextClient[prop] = (pageContext as PageContextUser)[prop]
  })

  assert(isPlainObject(pageContextClient))
  let pageContextSerialized: string

  const serialize = (v: unknown, varName?: string) => stringify(v, { forbidReactElements: true, valueName: varName })

  try {
    pageContextSerialized = serialize(pageContextClient)
  } catch (err) {
    const h = (s: string) => pc.cyan(s)
    let hasWarned = false
    const propsNonSerializable: string[] = []
    passToClient.forEach((prop) => {
      const propName = JSON.stringify(prop)
      const varName = h(`pageContext[${propName}]`)
      try {
        serialize((pageContext as Record<string, unknown>)[prop], varName)
      } catch (err) {
        hasWarned = true
        propsNonSerializable.push(prop)
        assert(hasProp(err, 'message', 'string'))
        assertWarning(
          false,
          [
            `${varName} cannot be serialized and, therefore, cannot be passed to the client.`,
            `Make sure that ${varName} is serializable, or remove ${h(propName)} from ${h('passToClient')}.`,
            `Serialization error: ${lowercaseFirstLetter(err.message)}`
          ].join(' '),
          { onlyOnce: false }
        )
      }
    })
    assert(hasWarned)
    propsNonSerializable.forEach((prop) => {
      pageContextClient[prop] = notSerializable
    })
    pageContextSerialized = serialize(pageContextClient)
  }

  return pageContextSerialized
}

function lowercaseFirstLetter(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

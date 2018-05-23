(window.webpackJsonp=window.webpackJsonp||[]).push([[6],{50:function(e,t,a){"use strict";a.r(t);var i=a(0),n=Object(i.a)({},function(){this.$createElement;this._self._c;return this._m(0)},[function(){var e=this,t=e.$createElement,a=e._self._c||t;return a("div",{staticClass:"content"},[a("h1",{attrs:{id:"graphql-schema"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#graphql-schema","aria-hidden":"true"}},[e._v("#")]),e._v(" GraphQL Schema")]),a("p"),a("div",{staticClass:"table-of-contents"},[a("ul")]),a("p"),a("p",[e._v("This plugin has an opinion of how the GraphQL API schema should look like:")]),a("ul",[a("li",[e._v("Query for multiple records is plural camelCase: "),a("code",[e._v("blogPosts")]),e._v(".")]),a("li",[e._v("Mutations begin with the verb ("),a("code",[e._v("create")]),e._v(", "),a("code",[e._v("update")]),e._v(", "),a("code",[e._v("delete")]),e._v(") and the camelCased entity: "),a("code",[e._v("createBlogPost")]),e._v(" for example.")]),a("li",[e._v("The create mutation expects the new record as a input type argument.")]),a("li",[e._v("The update mutation expects two arguments: The ID and the new record as a input type.")]),a("li",[e._v("The delete mutation expects the record ID to delete.")]),a("li",[e._v("Multiple records are within a "),a("code",[e._v("nodes")]),e._v(" object and filtered by a "),a("code",[e._v("filter")]),e._v(" argument.")])]),a("p",[e._v("You will find concrete examples of the GraphQL queries which are generated by this plugin in the\nrespective chapters of this documentation.")])])}],!1,null,null,null);t.default=n.exports}}]);